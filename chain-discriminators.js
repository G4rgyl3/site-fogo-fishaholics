// chain-discriminators.js
// Account + event discriminators (first 8 bytes), from IDL.

export const DISC_GLOBAL = new Uint8Array([163, 46, 74, 168, 216, 123, 133, 98]);
export const DISC_PLAYER = new Uint8Array([56, 3, 60, 86, 174, 16, 244, 195]);
export const DISC_FISH_CAUGHT = new Uint8Array([103, 248, 14, 11, 150, 185, 50, 179]);
