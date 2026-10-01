import { useState } from 'react'
import { ArrowUpRight, Type, PenLine, Stamp, Combine, Scissors, Minimize2, Image, FileImage } from 'lucide-react'
import { Link } from 'react-router-dom'

const groups = ['All tools', 'Edit & sign', 'Organize', 'Convert'] as const
type Group = typeof groups[number]
const tools: Array<{ title: string; description: string; group: Group; icon: typeof Type; to: string; note?: string }> = [
  {title:'Edit PDF',description:'Make changes to text and add your finishing touches.',group:'Edit & sign',icon:Type,to:'/documents',note:'Open a document in the editor'},
  {title:'Sign PDF',description:'Draw, type, or upload your signature.',group:'Edit & sign',icon:PenLine,to:'/documents',note:'Choose Sign in the editor'},
  {title:'Add watermark',description:'Apply a text or image watermark to your PDF.',group:'Edit & sign',icon:Stamp,to:'/documents',note:'Choose Watermark in the editor'},
  {title:'Merge PDF',description:'Bring separate PDFs together in the right order.',group:'Organize',icon:Combine,to:'/tools/merge'},
  {title:'Split & extract',description:'Split a PDF or keep just the pages you need.',group:'Organize',icon:Scissors,to:'/tools/split'},
  {title:'Compress PDF',description:'Prepare a smaller PDF for its next destination.',group:'Organize',icon:Minimize2,to:'/tools/compress'},
  {title:'PDF → Images',description:'Export PDF pages as PNG images.',group:'Convert',icon:Image,to:'/tools/convert',note:'Select PDF to Images'},
  {title:'Images → PDF',description:'Arrange JPG or PNG images into a document.',group:'Convert',icon:FileImage,to:'/tools/convert',note:'Select Images to PDF'},
]

export function ToolCatalog() {
  const [group,setGroup]=useState<Group>('All tools')
  return <div className="tool-catalog"><div className="catalog-filters" aria-label="Tool categories">{groups.map(item=><button type="button" key={item} aria-pressed={group===item} className={group===item?'active':''} onClick={()=>setGroup(item)}>{item}</button>)}</div><div className="catalog-grid">{tools.filter(tool=>group==='All tools'||tool.group===group).map(({icon:Icon,...tool})=><Link className="catalog-card" key={tool.title} to={tool.to}><span className="catalog-icon"><Icon size={23}/></span><ArrowUpRight size={16} className="catalog-arrow"/><h3>{tool.title}</h3><p>{tool.description}</p>{tool.note && <small>{tool.note}</small>}</Link>)}</div></div>
}
