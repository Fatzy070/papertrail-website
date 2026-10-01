import { ArrowUpRight, FileText, PenLine } from 'lucide-react'

export function AuthStory() {
  return <aside className="auth-story" aria-label="About Papertrail"><span className="eyebrow">A little less paperwork.</span><h2>Good work.<br />On your terms.</h2><p>Make the edit. Bring the pages together. Get your document ready for whatever comes next.</p><div className="story-paper" aria-hidden="true"><FileText size={24} /><small>THE NEXT CHAPTER</small><strong>Make it<br /><em>your own.</em></strong><div className="story-lines" /><span><PenLine size={16} /> Edited with Papertrail <ArrowUpRight size={16} /></span></div><p className="story-caption">Free to edit. Export from ₦500.<br />No subscription required.</p></aside>
}
