import sharp from 'sharp';
import fs from 'fs';

async function test() {
  try {
    // We don't have a PDF yet, but we can check if sharp supports it
    const format = await sharp.format;
    console.log(JSON.stringify(format, null, 2));
  } catch (e) {
    console.error(e);
  }
}

test();
