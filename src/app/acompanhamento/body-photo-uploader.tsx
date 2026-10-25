"use client";

import { useRef, useState, useTransition } from "react";
import { uploadCheckinPhotosAction, type PhotoUploadState } from "./actions";

export function BodyPhotoUploader({ checkinId, remainingSlots }: { checkinId: string; remainingSlots: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PhotoUploadState | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitPhotos() {
    const selected = Array.from(inputRef.current?.files ?? []).slice(0, remainingSlots);
    if (!selected.length) {
      setState({ ok: false, message: "Selecione pelo menos uma foto." });
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("checkinId", checkinId);

      for (const file of selected) {
        formData.append("bodyPhotos", await compressImage(file));
      }

      const result = await uploadCheckinPhotosAction(formData);
      setState(result ?? { ok: false, message: "Não foi possível anexar as fotos." });
      if (result?.ok && inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="mt-4 border-t border-hairline pt-3">
      <p className="text-xs text-text-muted">Adicionar fotos neste check-in</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="min-w-0 flex-1 rounded-[14px] bg-fill px-3 py-2 text-xs text-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-fill-strong file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-100"
        />
        <button
          type="button"
          onClick={submitPhotos}
          disabled={isPending}
          className="min-h-10 rounded-full bg-fill px-4 py-2 font-semibold text-text-primary hover:bg-fill-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Anexando..." : "Anexar"}
        </button>
      </div>
      {state ? <p className={`mt-2 text-xs ${state.ok ? "text-success" : "text-danger"}`}>{state.message}</p> : null}
      <p className="mt-2 text-xs text-text-muted">As fotos são reduzidas no navegador antes do envio para evitar erro por tamanho.</p>
    </div>
  );
}

async function compressImage(file: File) {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  bitmap.close();

  if (!blob) return file;
  const safeName = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${safeName}.jpg`, { type: "image/jpeg" });
}
