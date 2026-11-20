# Custom Cast receiver
Namespace: `urn:x-cast:com.smartbeam.presentation` (JSON).
Sender → receiver: `{type:'LOAD', kind:'pdf', url, page, title}` · `{type:'COMMAND', command:{type:'goto'|'pause'|'resume'|'blackout'|'pointer', ...}}` · `{type:'EXIT'}`.
Receiver → sender: `{type:'STATE', page, total}` · `{type:'ERROR', message}`.
Video/images use the standard Cast media channel (CAF `cast-media-player`). The receiver hides its PDF stage while media plays, shows "Presenter disconnected" and stops 10 s after the last sender leaves.
