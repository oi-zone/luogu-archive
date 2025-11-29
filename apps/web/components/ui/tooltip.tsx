type LinkWithPreviewProps = {
  overview: React.ReactNode;
  full: React.ReactNode;
};

export default function Tooltip({ overview, full }: LinkWithPreviewProps) {
  return (
    <span className="group/link-preview relative align-baseline">
      {overview}
      <span
        role="tooltip"
        aria-hidden="true"
        className="max-w-90vw pointer-events-auto absolute top-[1.2em] -left-[0.5em] z-20 mt-1 hidden w-max rounded-full bg-background/60 p-1 whitespace-nowrap shadow-lg ring-1 ring-border backdrop-blur group-focus-within/link-preview:flex group-hover/link-preview:flex"
      >
        {full}
      </span>
    </span>
  );
}
