export type PostImageSource = {
    imageUrl?: string | null;
    imageUrls?: string[] | null;
};

export function getPostImageUrls(source: PostImageSource): string[] {
    const urls = Array.isArray(source.imageUrls) ? source.imageUrls.filter(Boolean) : [];
    if (urls.length > 0) return urls;
    return source.imageUrl ? [source.imageUrl] : [];
}
