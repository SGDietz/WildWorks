// Observe only the SDK's decoded, allowlisted speech events. Do not change
// SDK dispatch, transport or audio. Unknown upstream code stays untouched.
export function bridgeIScottAvatarSpeechEvents(source: string): string {
  const anchor = "if(i){let[e,...t]=i;this.emit(e,...t)}";
  if (!source.includes('AVATAR_SPEAK_ENDED="avatar.speak_ended"')
    || !source.includes('USER_TRANSCRIPTION="user.transcription"')
    || source.split(anchor).length !== 2) return source;
  return source.replace(anchor,
    "if(i){let[e,...t]=i;try{window.__wildworksAvatarSpeechEvent?.(this.sessionClient.sessionToken,e,t[0])}catch{}this.emit(e,...t)}");
}

export function versionIScottSpeechAssetReferences(html: string): string {
  return html.replace(/\/pages\/avatar-iscott-assets\/_next\/static\/chunks\/app\/page-[a-f0-9]+\.js(?![?a-z0-9])/g, "$&?ww-speech=1");
}
