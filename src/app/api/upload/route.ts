import { NextResponse } from 'next/server';

const IMGBB_KEYS = [
  process.env.IMGBB_API_KEY || '',
  process.env.IMGBB_API_KEY_FALLBACK_1 || '',
  process.env.IMGBB_API_KEY_FALLBACK_2 || '',
  'b8773b33f1f4eac08fdc8056c9daf1dd',
  '6d207e02198a847aa5ad3ac2292fc10a',
  'd93c042ef3a6dc9e201b1a8d0f1712a3'
].filter(Boolean);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawImage = body?.image;

    if (!rawImage || typeof rawImage !== 'string') {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    if (rawImage.length > 15 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Image exceeds maximum 10MB limit' }, { status: 413 });
    }

    // Strip data URL scheme prefix if present
    const cleanBase64 = rawImage.replace(/^data:image\/[a-zA-Z0-9.+]+;base64,/, '');

    for (let i = 0; i < IMGBB_KEYS.length; i++) {
      const activeKey = IMGBB_KEYS[i];
      try {
        const formData = new FormData();
        formData.append('key', activeKey);
        formData.append('image', cleanBase64);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);

        const res = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data?.success && data?.data?.url) {
            return NextResponse.json({
              success: true,
              url: data.data.url,
              thumb: data?.data?.thumb?.url || data.data.url
            });
          }
        }
      } catch (err) {
        // try next fallback key
      }
    }

    return NextResponse.json({
      success: false,
      error: 'All upload endpoints busy. Preserved original image data.'
    }, { status: 502 });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'Upload processing failed'
    }, { status: 500 });
  }
}
