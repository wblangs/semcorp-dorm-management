import { primaryButtonClass } from "./FormField";

type ErrorDialogProps = {
  message: string;
  onClose: () => void;
};

/** Centered modal popup for error / constraint messages. Renders nothing when message is empty. */
export function ErrorDialog({ message, onClose }: ErrorDialogProps) {
  if (!message) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-lg font-bold text-rose-600">
            !
          </span>
          <h3 className="text-sm font-semibold text-slate-900">操作未完成</h3>
        </div>
        <p className="whitespace-pre-wrap text-sm text-slate-700">{message}</p>
        <div className="mt-5 flex justify-end">
          <button type="button" className={primaryButtonClass} onClick={onClose}>
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}
