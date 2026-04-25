let audioContext: AudioContext | null = null;
let gainNode: GainNode | null = null;
let moveSoundBuffer: AudioBuffer | null = null;
let captureSoundBuffer: AudioBuffer | null = null;
let volume = 1.0; // store it here so it survives before gainNode exists

async function loadSound(url: string, context: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return context.decodeAudioData(arrayBuffer);
}

function playBuffer(buffer: AudioBuffer) {
  if (!audioContext || !gainNode) return;
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(gainNode);
  source.start(0);
}

export async function preloadSounds() {
  if (audioContext) return;

  audioContext = new AudioContext();
  gainNode = audioContext.createGain();
  gainNode.gain.value = volume; // apply whatever was set before init
  gainNode.connect(audioContext.destination);

  [moveSoundBuffer, captureSoundBuffer] = await Promise.all([
    loadSound("/sounds/move.mp3", audioContext),
    loadSound("/sounds/capture.mp3", audioContext),
  ]);
}

export function setVolume(v: number) {
  volume = v;
  if (gainNode) gainNode.gain.value = v;
}

export function playMove() {
  if (moveSoundBuffer) playBuffer(moveSoundBuffer);
}

export function playCapture() {
  if (captureSoundBuffer) playBuffer(captureSoundBuffer);
}
