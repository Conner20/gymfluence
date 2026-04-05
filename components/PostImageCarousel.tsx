'use client';

import { useEffect, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

export default function PostImageCarousel({
    imageUrls,
    alt,
    onOpen,
    className,
    imageClassName,
}: {
    imageUrls: string[];
    alt: string;
    onOpen?: () => void;
    className?: string;
    imageClassName?: string;
}) {
    const [index, setIndex] = useState(0);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [frameHeight, setFrameHeight] = useState<number | null>(null);
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setIndex(0);
        setControlsVisible(true);
    }, [imageUrls]);

    useEffect(() => {
        setFrameHeight(null);
    }, [imageUrls]);

    if (!imageUrls.length) return null;

    const isMulti = imageUrls.length > 1;
    const goPrev = () => setIndex((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1));
    const goNext = () => setIndex((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1));

    useEffect(() => {
        if (!isMulti || typeof window === 'undefined') return;

        let cancelled = false;

        const computeHeight = async () => {
            const containerWidth = containerRef.current?.clientWidth ?? 0;
            if (!containerWidth) return;

            const heights = await Promise.all(
                imageUrls.map(
                    (url) =>
                        new Promise<number>((resolve) => {
                            const image = new window.Image();
                            image.onload = () => {
                                const naturalWidth = image.naturalWidth || containerWidth;
                                const naturalHeight = image.naturalHeight || 0;
                                if (!naturalHeight) {
                                    resolve(0);
                                    return;
                                }
                                const scaledHeight = (containerWidth / naturalWidth) * naturalHeight;
                                resolve(Math.min(540, scaledHeight));
                            };
                            image.onerror = () => resolve(0);
                            image.src = url;
                        }),
                ),
            );

            if (cancelled) return;
            const maxHeight = Math.max(...heights.filter((height) => height > 0), 0);
            setFrameHeight(maxHeight || null);
        };

        computeHeight();

        const observer = new ResizeObserver(() => {
            void computeHeight();
        });
        if (containerRef.current) observer.observe(containerRef.current);

        return () => {
            cancelled = true;
            observer.disconnect();
        };
    }, [imageUrls, isMulti]);

    const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
        touchEndX.current = null;
    };

    const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
        touchEndX.current = event.touches[0]?.clientX ?? null;
    };

    const handleTouchEnd = () => {
        if (!isMulti || touchStartX.current === null || touchEndX.current === null) return;
        const delta = touchStartX.current - touchEndX.current;
        if (Math.abs(delta) < 40) return;
        if (delta > 0) {
            goNext();
        } else {
            goPrev();
        }
    };

    const handleImageClick = () => {
        if (!isMulti) return;
        setControlsVisible((prev) => !prev);
    };

    return (
        <div
            ref={containerRef}
            className={clsx(
                'relative overflow-hidden rounded-xl border bg-zinc-50 dark:border-white/10 dark:bg-white/5',
                className,
            )}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div
                className="flex items-center justify-center"
                style={isMulti && frameHeight ? { height: `${frameHeight}px` } : undefined}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={imageUrls[index]!}
                    alt={alt}
                    className={clsx(
                        'mx-auto block max-h-[540px] max-w-full object-contain',
                        (onOpen || isMulti) && 'cursor-pointer',
                        imageClassName,
                    )}
                    onClick={handleImageClick}
                    onDoubleClick={onOpen}
                />
            </div>

            {isMulti && (
                <>
                    {controlsVisible && (
                        <>
                            <button
                                type="button"
                                aria-label="Previous image"
                                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/75"
                                onClick={goPrev}
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                type="button"
                                aria-label="Next image"
                                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/75"
                                onClick={goNext}
                            >
                                <ChevronRight size={18} />
                            </button>
                        </>
                    )}
                    <div
                        className={clsx(
                            'absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white transition',
                            controlsVisible ? 'opacity-100' : 'opacity-0',
                        )}
                    >
                        {index + 1}/{imageUrls.length}
                    </div>
                    <div
                        className={clsx(
                            'absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2 py-1 transition',
                            controlsVisible ? 'opacity-100' : 'opacity-0',
                        )}
                    >
                        {imageUrls.map((_, dotIndex) => (
                            <button
                                key={dotIndex}
                                type="button"
                                aria-label={`Go to image ${dotIndex + 1}`}
                                onClick={() => setIndex(dotIndex)}
                                className={clsx(
                                    'h-2 w-2 rounded-full transition',
                                    dotIndex === index ? 'bg-white' : 'bg-white/45 hover:bg-white/70',
                                )}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
