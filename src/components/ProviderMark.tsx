import codexLogo from "../../codex.svg";

export function ProviderMark({ active = false, onClick }: { active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      className={`provider-mark${active ? " provider-mark--active" : ""}`}
      aria-label={active ? "退出色彩预览" : "打开色彩预览"}
      aria-pressed={active}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={onClick}
    >
      <img src={codexLogo} alt="" />
    </button>
  );
}
