export interface ExtractResult {
  success:boolean;
  data?:{
    videoHdUrl?:string; videoUrl?:string; cover?:string; originCover?:string;
    isSlideShow?:boolean; images?:string[]; audioUrl?:string;
    title?:string; duration?:number;
    musicInfo?:{title?:string}; stats?:{diggCount?:number}
  };
  error?:string
}
export async function extractTikTokVideo(url:string):Promise<ExtractResult>{
  const r=await fetch('/api/tiktok/extract',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});
  const d=await r.json(); return d;
}
