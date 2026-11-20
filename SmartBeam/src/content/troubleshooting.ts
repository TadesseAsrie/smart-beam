export interface Topic { id: string; title: string; causes: string[]; fixes: string[] }

export const TROUBLESHOOTING: Topic[] = [
  {
    id: 'not-found', title: 'Projector not found',
    causes: ['The projector/TV is off, asleep, or not in wireless/cast mode.', 'It is not a Google Cast receiver (many projectors only support Miracast or HDMI).', 'The "Nearby devices" permission was denied.'],
    fixes: ['Turn the projector on and select its wireless/cast input.', 'Open the Connection Assistant to see which methods your phone supports.', 'Allow "Nearby devices" in Android Settings → Apps → SmartBeam → Permissions.', 'Pull to refresh the device list.']
  },
  {
    id: 'unsupported-protocol', title: 'Unsupported wireless protocol',
    causes: ['The projector only supports Miracast, AirPlay or a proprietary dongle.', 'Your phone does not offer wireless display (Smart View / Screen Cast).'],
    fixes: ['Use "Android screen mirroring" and connect in Android settings.', 'Use an HDMI or USB-C adapter with the External display option.', 'Open the receiver page on a browser-capable screen and scan its QR code (cloud room).']
  },
  {
    id: 'wifi', title: 'Wi-Fi disconnected',
    causes: ['The phone is on mobile data only.', 'Wi-Fi was turned off or dropped while presenting.'],
    fixes: ['Connect to the same Wi-Fi network as the projector.', 'Turn Wi-Fi off and on, then refresh devices.']
  },
  {
    id: 'different-network', title: 'Different network',
    causes: ['The phone and the receiver are on different Wi-Fi networks, guest networks, or VLANs.', 'The network blocks device-to-device discovery (client isolation).'],
    fixes: ['Join the same network/band (2.4 GHz vs 5 GHz) as the receiver.', 'Ask the network administrator to allow mDNS / disable client isolation.', 'Use a phone hotspot that both the phone and receiver join, or an HDMI connection.']
  },
  {
    id: 'timeout', title: 'Connection timeout',
    causes: ['The receiver is busy with another sender.', 'Weak Wi-Fi signal or a congested network.'],
    fixes: ['Move closer to the router/projector.', 'Restart the Cast receiver (unplug it for 10 seconds).', 'Try again — SmartBeam never reports a connection until the receiver confirms it.']
  },
  {
    id: 'unsupported-file', title: 'Unsupported file',
    causes: ['The file type is not supported, the file is damaged, or it is password protected.', 'Legacy .ppt/.doc files need conversion.'],
    fixes: ['Use PDF, PPT/PPTX, DOC/DOCX, JPG/PNG or MP4/MOV.', 'Re-save the file as PDF or PPTX from the original app.', 'Set up the optional SmartBeam server in Settings to convert Office files.']
  },
  {
    id: 'receiver-unavailable', title: 'Receiver unavailable',
    causes: ['Google Cast cannot display PDF/PowerPoint without the SmartBeam custom receiver.', 'The cloud room page was closed or reloaded.'],
    fixes: ['Register the custom receiver and rebuild with SMARTBEAM_CAST_APP_ID (see README).', 'Reopen the receiver page and scan its new QR code.', 'Videos and images work with the default Cast receiver.']
  },
  {
    id: 'display-disconnected', title: 'Display disconnected',
    causes: ['The HDMI/USB-C cable or adapter was unplugged.', 'The wireless display went to sleep or lost power.'],
    fixes: ['Reconnect the cable/adapter and reconnect from the Connect tab.', 'Your presentation position is saved — resume it from History.']
  }
];
