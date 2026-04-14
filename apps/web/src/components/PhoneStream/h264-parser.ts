/**
 * H264 NAL unit parser + SPS decoder for WebCodecs codec string.
 *
 * Handles both 3-byte (00 00 01) and 4-byte (00 00 00 01) start codes.
 */

export const NAL_TYPE = {
  NON_IDR: 1,
  IDR: 5,
  SEI: 6,
  SPS: 7,
  PPS: 8,
} as const;

export interface NalUnit {
  type: number;
  data: Uint8Array; // raw NAL bytes without start code
}

/**
 * Find all NAL unit boundaries in a buffer.
 * Returns array of offsets where NAL data starts (after start code).
 */
function findStartCodes(buf: Uint8Array): { offset: number; scLen: number }[] {
  const positions: { offset: number; scLen: number }[] = [];
  let i = 0;
  while (i < buf.length - 2) {
    if (buf[i] === 0 && buf[i + 1] === 0) {
      if (i + 3 < buf.length && buf[i + 2] === 0 && buf[i + 3] === 1) {
        positions.push({ offset: i + 4, scLen: 4 });
        i += 4;
        continue;
      }
      if (buf[i + 2] === 1) {
        positions.push({ offset: i + 3, scLen: 3 });
        i += 3;
        continue;
      }
    }
    i++;
  }
  return positions;
}

/**
 * Parse a binary buffer into individual NAL units.
 */
export function parseNalUnits(buf: Uint8Array): NalUnit[] {
  const positions = findStartCodes(buf);
  if (positions.length === 0) return [];

  const units: NalUnit[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].offset;
    const end =
      i + 1 < positions.length ? positions[i + 1].offset - positions[i + 1].scLen : buf.length;
    if (start >= end) continue;
    const data = buf.slice(start, end);
    const type = data[0] & 0x1f;
    units.push({ type, data });
  }
  return units;
}

/**
 * Decode SPS to extract profile, constraints, and level for codec string.
 * Returns something like "avc1.640028" (High profile, level 4.0).
 */
export function spsToCodecString(sps: Uint8Array): string {
  // SPS NAL header is byte 0, profile_idc is byte 1
  if (sps.length < 4) return "avc1.42001e"; // fallback: Baseline level 3.0

  const profileIdc = sps[1];
  const constraintFlags = sps[2];
  const levelIdc = sps[3];

  const profile = profileIdc.toString(16).padStart(2, "0");
  const compat = constraintFlags.toString(16).padStart(2, "0");
  const level = levelIdc.toString(16).padStart(2, "0");

  return `avc1.${profile}${compat}${level}`;
}

/**
 * Extract width and height from SPS using Exp-Golomb decoding.
 */
export function parseSPSDimensions(sps: Uint8Array): { width: number; height: number } | null {
  if (sps.length < 5) return null;
  try {
    const reader = new BitReader(sps, 8); // skip NAL header byte

    const profileIdc = reader.readBits(8);
    reader.readBits(8); // constraint flags
    reader.readBits(8); // level_idc
    reader.readUE(); // seq_parameter_set_id

    if ([100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134].includes(profileIdc)) {
      const chromaFormatIdc = reader.readUE();
      if (chromaFormatIdc === 3) reader.readBits(1); // separate_colour_plane_flag
      reader.readUE(); // bit_depth_luma_minus8
      reader.readUE(); // bit_depth_chroma_minus8
      reader.readBits(1); // qpprime_y_zero_transform_bypass_flag
      const seqScalingMatrixPresent = reader.readBits(1);
      if (seqScalingMatrixPresent) {
        const cnt = chromaFormatIdc !== 3 ? 8 : 12;
        for (let i = 0; i < cnt; i++) {
          if (reader.readBits(1)) {
            skipScalingList(reader, i < 6 ? 16 : 64);
          }
        }
      }
    }

    reader.readUE(); // log2_max_frame_num_minus4
    const picOrderCntType = reader.readUE();
    if (picOrderCntType === 0) {
      reader.readUE(); // log2_max_pic_order_cnt_lsb_minus4
    } else if (picOrderCntType === 1) {
      reader.readBits(1); // delta_pic_order_always_zero_flag
      reader.readSE(); // offset_for_non_ref_pic
      reader.readSE(); // offset_for_top_to_bottom_field
      const numRefFrames = reader.readUE();
      for (let i = 0; i < numRefFrames; i++) reader.readSE();
    }

    reader.readUE(); // max_num_ref_frames
    reader.readBits(1); // gaps_in_frame_num_value_allowed_flag

    const picWidthInMbsMinus1 = reader.readUE();
    const picHeightInMapUnitsMinus1 = reader.readUE();
    const frameMbsOnly = reader.readBits(1);

    if (!frameMbsOnly) reader.readBits(1); // mb_adaptive_frame_field_flag

    reader.readBits(1); // direct_8x8_inference_flag

    let cropLeft = 0,
      cropRight = 0,
      cropTop = 0,
      cropBottom = 0;
    const frameCropping = reader.readBits(1);
    if (frameCropping) {
      cropLeft = reader.readUE();
      cropRight = reader.readUE();
      cropTop = reader.readUE();
      cropBottom = reader.readUE();
    }

    const width = (picWidthInMbsMinus1 + 1) * 16 - (cropLeft + cropRight) * 2;
    const height =
      (2 - frameMbsOnly) * (picHeightInMapUnitsMinus1 + 1) * 16 - (cropTop + cropBottom) * 2;

    return { width, height };
  } catch {
    return null;
  }
}

function skipScalingList(reader: BitReader, size: number) {
  let lastScale = 8;
  let nextScale = 8;
  for (let j = 0; j < size; j++) {
    if (nextScale !== 0) {
      const delta = reader.readSE();
      nextScale = (lastScale + delta + 256) % 256;
    }
    lastScale = nextScale === 0 ? lastScale : nextScale;
  }
}

class BitReader {
  private data: Uint8Array;
  private byteOffset: number;
  private bitOffset: number;

  constructor(data: Uint8Array, byteOffset = 0) {
    this.data = data;
    this.byteOffset = byteOffset;
    this.bitOffset = 0;
  }

  readBits(n: number): number {
    let val = 0;
    for (let i = 0; i < n; i++) {
      if (this.byteOffset >= this.data.length) throw new Error("EOF");
      val = (val << 1) | ((this.data[this.byteOffset] >> (7 - this.bitOffset)) & 1);
      this.bitOffset++;
      if (this.bitOffset === 8) {
        this.bitOffset = 0;
        this.byteOffset++;
      }
    }
    return val;
  }

  readUE(): number {
    let zeros = 0;
    while (this.readBits(1) === 0) zeros++;
    if (zeros === 0) return 0;
    return (1 << zeros) - 1 + this.readBits(zeros);
  }

  readSE(): number {
    const val = this.readUE();
    return val & 1 ? (val + 1) >> 1 : -(val >> 1);
  }
}

/**
 * Build an Annex B byte stream from NAL units (prepend 00 00 00 01 start codes).
 */
export function buildAnnexB(...nals: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const nal of nals) totalLen += 4 + nal.length;

  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const nal of nals) {
    out[offset] = 0;
    out[offset + 1] = 0;
    out[offset + 2] = 0;
    out[offset + 3] = 1;
    out.set(nal, offset + 4);
    offset += 4 + nal.length;
  }
  return out;
}
