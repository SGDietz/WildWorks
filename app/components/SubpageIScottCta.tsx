import TalkArcClusterIcon from "./TalkArcClusterIcon";

export default function SubpageIScottCta() {
  return (
    <div className="wild-subpage-iscott-cta">
      <a href="/pages/Home?wake-iscott=1#talk-to-iscott" className="money-cta money-cta--primary" aria-label="Start with iScott" data-iscott-start-cta="">
        <TalkArcClusterIcon />
        <span>Start with iScott</span>
      </a>
    </div>
  );
}
