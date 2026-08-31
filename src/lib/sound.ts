export type SoundEffectName = string;
const noop=(name?:SoundEffectName):void=>{void name};
export const soundEffects={play:noop};
