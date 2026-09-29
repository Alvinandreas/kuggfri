"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { sv } from "@/lib/i18n/sv";
import { IconButton } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";

const HEIGHT = { sm: "max-h-64", md: "max-h-72", lg: "max-h-[26rem]" } as const;
/** Höga figurer (t.ex. egenskapstabeller) visas i läsbar bredd och beskurna i stället för krympta. */
const TALL_RATIO = 1.5;

type Size = keyof typeof HEIGHT;

function Thumb({ src, alt, size, onOpen, label }: { src: string; alt: string; size: Size; onOpen: () => void; label: string }) {
  const [tall, setTall] = useState(false);
  const measure = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth > 0) setTall(img.naturalHeight / img.naturalWidth > TALL_RATIO);
  }, []);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      className={cx(
        "group relative block max-w-full cursor-zoom-in overflow-hidden rounded-md border border-line bg-white p-2 text-left transition-shadow hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30",
        tall && cx(HEIGHT[size], "w-full sm:w-[34rem]"),
      )}
      data-testid="exam-figure"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- figuren kommer från tentabanken via tentans bildadress */}
      <img
        ref={measure}
        src={src}
        alt={alt}
        onLoad={(e) => setTall(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth > TALL_RATIO)}
        className={cx(tall ? "h-auto w-full" : cx(HEIGHT[size], "w-auto max-w-full"))}
      />
      {tall ? <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-white/0" /> : null}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-inverse/85 px-2.5 py-1 text-xs font-semibold text-inverse-fg opacity-90 shadow-sm transition-opacity group-hover:opacity-100"
      >
        <Maximize2 size={12} aria-hidden />
        {tall ? sv.tenta.figureShowAll : sv.tenta.figureEnlarge}
      </span>
    </button>
  );
}

/** Förstorad figur: hela skärmen, rullbar, zoom, bläddring mellan uppgiftens figurer. Esc stänger. */
function Lightbox({ images, index, onIndex, onClose }: { images: string[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(false);

  // Monteras bara när en figur är öppen; stängs genom att avmonteras.
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  useEffect(() => setZoom(false), [index]);

  const many = images.length > 1;
  const go = (d: number) => onIndex((index + d + images.length) % images.length);

  return (
    <dialog
      ref={ref}
      aria-label={many ? sv.tenta.figureOf(index + 1, images.length) : sv.tenta.figure}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      className="ui-modal m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-fg"
      data-testid="figure-lightbox"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 bg-surface px-3 py-2 shadow-card sm:px-5">
          <p className="text-sm font-semibold tabular-nums">{many ? sv.tenta.figureOf(index + 1, images.length) : sv.tenta.figure}</p>
          <div className="flex items-center gap-1.5">
            <IconButton label={zoom ? sv.tenta.figureZoomOut : sv.tenta.figureZoomIn} variant="outline" onClick={() => setZoom((z) => !z)} data-testid="figure-zoom">
              {zoom ? <ZoomOut size={18} aria-hidden /> : <ZoomIn size={18} aria-hidden />}
            </IconButton>
            {many ? (
              <>
                <IconButton label={sv.tenta.figurePrev} variant="outline" onClick={() => go(-1)}>
                  <ChevronLeft size={18} aria-hidden />
                </IconButton>
                <IconButton label={sv.tenta.figureNext} variant="outline" onClick={() => go(1)} data-testid="figure-next">
                  <ChevronRight size={18} aria-hidden />
                </IconButton>
              </>
            ) : null}
            <IconButton label={sv.common.close} variant="secondary" onClick={onClose} data-testid="figure-close">
              <X size={18} aria-hidden />
            </IconButton>
          </div>
        </div>
        <div
          className="min-h-0 flex-1 overflow-auto overscroll-contain p-3 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- figuren kommer från tentabanken via tentans bildadress */}
          <img
            key={index}
            src={images[index]}
            alt={many ? sv.tenta.figureOf(index + 1, images.length) : sv.tenta.figure}
            onClick={() => setZoom((z) => !z)}
            className={cx(
              "mx-auto block rounded-md bg-white p-2 shadow-pop sm:p-3",
              zoom ? "w-[200%] max-w-none cursor-zoom-out sm:w-auto sm:min-w-[min(100%,72rem)] sm:max-w-[200%]" : "h-auto w-auto max-w-full cursor-zoom-in sm:max-w-[min(100%,72rem)]",
            )}
          />
        </div>
      </div>
    </dialog>
  );
}

/**
 * Uppgiftens figurer, i ordning och bredvid varandra när de får plats. Varje figur kan förstoras
 * (klick): höga tabeller visas beskurna med "Visa hela" och går att rulla och zooma i förstoringen.
 */
export function ExamFigures({ images, size, className = "" }: { images: string[]; size: Size; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  const many = images.length > 1;
  return (
    <div className={`flex flex-wrap items-start gap-3 ${className}`.trim()}>
      {images.map((src, i) => (
        <Thumb
          key={i}
          src={src}
          alt={many ? sv.tenta.figureOf(i + 1, images.length) : ""}
          size={size}
          onOpen={() => setOpen(i)}
          label={many ? `${sv.tenta.figureEnlarge}: ${sv.tenta.figureOf(i + 1, images.length)}` : sv.tenta.figureEnlarge}
        />
      ))}
      {open !== null ? <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
