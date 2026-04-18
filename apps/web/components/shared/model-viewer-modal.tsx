"use client";

import { useEffect, useRef } from "react";
import { Viewer3D } from "./model-preview";

type ModelViewerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  file?: File | null;
  jobId?: string;
  fileName: string;
};

export function ModelViewerModal({
  isOpen,
  onClose,
  file,
  jobId,
  fileName,
}: ModelViewerModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 w-full max-w-none overflow-auto rounded-none border-0 bg-space-900/95 backdrop:bg-black/50"
      onClose={handleClose}
    >
      <div className="flex h-screen flex-col">
        <div className="flex items-center justify-between border-b border-blue-mid/20 px-6 py-4">
          <h2 className="text-lg font-semibold text-cream">{fileName}</h2>
          <button
            onClick={handleClose}
            className="text-cream/70 hover:text-cream"
            aria-label="Close"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <Viewer3D
            file={file}
            jobId={jobId}
            fileName={fileName}
            className="h-full"
          />
        </div>
      </div>
    </dialog>
  );
}
