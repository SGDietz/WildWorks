/**
 * The iScott prompt — the two-line invitation that sits directly above a
 * "Talk to iScott" button.
 *
 * G, 2026-08-25, on the Projects page line: "I love how this says 'open any
 * picture, then tell iScott which feeling you want on your land.' That pushes
 * people towards iScott. It pushes them towards sales." He then approved three
 * more, for The Ruins, Wildfire and the bio page.
 *
 * WHY IT IS A COMPONENT: the point of the device is that it is the SAME voice
 * speaking in the same shape every time somebody reaches the bottom of a page.
 * Three hand-written copies would drift within a month. One component, one
 * stylesheet (H389), one look.
 *
 * THE SHAPE, and it is deliberate — do not "simplify" it:
 *   line one  = the setup, in Text 3 (#f08c28), carrying the extra upper-side
 *               shadow. It is the line that names iScott.
 *   line two  = the ask, in Text 1 (#fce0ad).
 * That is exactly the pairing on the Projects page that G singled out. The
 * colour flip between the two lines is what makes the second line land.
 *
 * Each line names a specific sentence the visitor can say. That is the whole
 * mechanism: a button says "Talk to iScott", which is a task and gets put off.
 * "Tell iScott what you see on yours" is a desire, and it gets acted on.
 */

type IScottPromptLinesProps = {
  /** The setup. Text 3, with the upper shadow. Names iScott.
      OPTIONAL since 2026-08-27: G removed it on the Wildfire page ("remove
      That's One Build Breaking Ground to First Fire... just put on there,
      Tell iScott where you should start"). The Ruins and who-is-g still pass it. */
  setup?: string;
  /** The ask. Text 1. */
  ask: string;
  className?: string;
};

export default function IScottPromptLines({
  setup,
  ask,
  className = "",
}: IScottPromptLinesProps) {
  return (
    <p className={`wild-iscott-prompt${className ? ` ${className}` : ""}`}>
      {setup ? <span className="wild-iscott-prompt__setup">{setup}</span> : null}
      <span className="wild-iscott-prompt__ask">{ask}</span>
    </p>
  );
}
