import { useMemo, useState, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/media-url";

type PostImageCarouselProps = {
  images: string[];
  alt: string;
  className?: string;
};

export function PostImageCarousel({ images, alt, className }: PostImageCarouselProps) {
  const safeImages = useMemo(() => (images.length ? images : []), [images]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  if (!safeImages.length) {
    return <div className={className} />;
  }

  const maxIndex = safeImages.length - 1;
  const canMove = safeImages.length > 1;

  const goPrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? maxIndex : prev - 1));
  };

  const goNext = () => {
    setCurrentIndex((prev) => (prev === maxIndex ? 0 : prev + 1));
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.changedTouches[0]?.clientX ?? null);
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) {
      return;
    }
    const endX = event.changedTouches[0]?.clientX ?? touchStartX;
    const delta = endX - touchStartX;
    setTouchStartX(null);
    if (Math.abs(delta) < 40) {
      return;
    }
    if (delta > 0) {
      goPrev();
      return;
    }
    goNext();
  };

  return (
    <div className={className} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <img
        src={resolveMediaUrl(safeImages[currentIndex])}
        alt={alt}
        className="h-full w-full object-cover"
      />
      {canMove && (
        <>
          <Button
            type="button"
            size="icon-xs"
            variant="secondary"
            className="absolute left-2 top-1/2 -translate-y-1/2"
            onClick={goPrev}
            aria-label="Previous image"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="secondary"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={goNext}
            aria-label="Next image"
          >
            <ChevronRight className="size-4" />
          </Button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/40 px-2 py-1">
            {safeImages.map((_, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: stable order from stored image list
                key={index}
                className={`size-1.5 rounded-full ${index === currentIndex ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
