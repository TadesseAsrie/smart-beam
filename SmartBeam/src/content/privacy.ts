export const PRIVACY_POLICY = `SmartBeam privacy policy

Your files stay on your phone.
SmartBeam works fully offline for local PDF, image and video viewing. It has no account system and no analytics.

What is stored on the device
• Copies of the files you import (in app-private storage) and their metadata.
• Presentation history (file name, last slide, duration). You can turn this off or clear it in Settings.
• Your preferences and the last connected projector.

When a file leaves the phone
• Only after you tap "Upload" on an explicit consent prompt, and only to the SmartBeam server address you configured.
• Used for: converting PowerPoint/Word to PDF, and for Cast PDF presenting or cloud rooms.
• Temporary copies are deleted when you end the presentation and expire automatically on the server.
• Videos and images shown on Google Cast are served directly from your phone over your local network with one-time links and are never uploaded.

Permissions
• Camera: only to scan a receiver QR code.
• Nearby devices (Android 13+): only to find Cast receivers on your Wi-Fi.
• Storage: no broad storage permission. Files are chosen with the Android file picker, or from folders you explicitly grant.

You can delete imported files, converted copies, thumbnails and history at any time in Settings → Files & storage.`;

export const PERMISSION_EXPLANATIONS = [
  { name: 'Camera', why: 'Scan the QR code on a receiver screen to pair it. Never used for photos or video recording.' },
  { name: 'Nearby devices', why: 'Android 13+ requires this to discover Cast receivers on your Wi-Fi network.' },
  { name: 'Folder access', why: 'Granted per folder through Android’s file picker. You can revoke it in Settings → Files & storage.' },
  { name: 'Network', why: 'Cast control, local media serving and the optional SmartBeam server.' }
];
