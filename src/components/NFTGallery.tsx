import React, { useState, useMemo } from 'react';
import { Image, ExternalLink, Music, Video, Palette, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

interface NFT {
  tokenId: string;
  name: string;
  description: string;
  type: 'NFT' | 'Audio' | 'Video' | 'Artwork Collection';
  artworkUrl: string | null;
}

interface NFTGalleryProps {
  nfts: NFT[];
  isLoading?: boolean;
}

export const NFTGallery: React.FC<NFTGalleryProps> = ({ nfts, isLoading = false }) => {
  const [selectedType, setSelectedType] = useState<string>('All');
  const [page, setPage] = useState(0);
  // Track which images have failed to load
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const types = ['All', 'NFT', 'Audio', 'Video', 'Artwork Collection'];

  const openExplorer = (tokenId: string) => {
    window.open(`https://ergexplorer.com/token#${tokenId}`, '_blank');
  };

  const handleImageError = (tokenId: string) => {
    setFailedImages(prev => new Set(prev).add(tokenId));
  };

  // Get the image URL - uses IPFS URL from token metadata
  const getImageUrl = (nft: NFT): string | null => {
    if (failedImages.has(nft.tokenId)) {
      return null; // Show placeholder
    }
    return nft.artworkUrl || null;
  };

  // Filter by type
  const filteredNfts = useMemo(() => {
    return selectedType === 'All'
      ? nfts
      : nfts.filter(nft => nft.type === selectedType);
  }, [nfts, selectedType]);

  // Pagination
  const totalPages = Math.ceil(filteredNfts.length / PAGE_SIZE);
  const paginatedNfts = filteredNfts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handlePrevPage = () => setPage(p => Math.max(0, p - 1));
  const handleNextPage = () => setPage(p => Math.min(totalPages - 1, p + 1));

  // Reset page when filter changes
  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setPage(0);
  };

  const getIcon = (type: NFT['type']) => {
    switch (type) {
      case 'Audio':
        return <Music className="w-8 h-8" />;
      case 'Video':
        return <Video className="w-8 h-8" />;
      case 'Artwork Collection':
        return <Palette className="w-8 h-8" />;
      default:
        return <Image className="w-8 h-8" />;
    }
  };

  const getTypeColor = (type: NFT['type']) => {
    switch (type) {
      case 'Audio':
        return 'bg-purple-600';
      case 'Video':
        return 'bg-red-600';
      case 'Artwork Collection':
        return 'bg-pink-600';
      default:
        return 'bg-blue-600';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
        <div className="flex items-center space-x-2 mb-4">
          <Image className="w-5 h-5 text-pink-400" />
          <h2 className="text-xl font-bold text-white">NFTs & Collectibles</h2>
        </div>
        <div className="text-gray-400 text-center py-8">
          Loading NFTs...
        </div>
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
        <div className="flex items-center space-x-2 mb-4">
          <Image className="w-5 h-5 text-pink-400" />
          <h2 className="text-xl font-bold text-white">NFTs & Collectibles</h2>
        </div>
        <div className="text-gray-400 text-center py-8">
          <p>No NFTs found in this wallet</p>
          <p className="text-sm mt-2">NFTs are tokens with a quantity of 1 and no decimals</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 p-4 md:p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Image className="w-4 sm:w-5 h-4 sm:h-5 text-pink-400" />
          <h2 className="text-base md:text-lg font-bold text-white">NFTs & Collectibles</h2>
        </div>

        {/* Mobile: Compact dropdown filter */}
        <select
          value={selectedType}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="md:hidden bg-gray-800 text-white text-xs px-2 py-1.5 rounded border border-gray-700 focus:outline-none focus:border-gray-600"
        >
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        {/* Desktop: Item count */}
        <span className="hidden md:block text-gray-400 text-sm">{filteredNfts.length} item{filteredNfts.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Desktop: Filter buttons */}
      <div className="hidden md:flex flex-wrap gap-2 mb-4">
        {types.map((type) => (
          <button
            key={type}
            className={`px-3 py-1 rounded-lg text-sm ${
              selectedType === type
                ? 'bg-pink-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            onClick={() => handleTypeChange(type)}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {paginatedNfts.map((nft) => (
          <div
            key={nft.tokenId}
            className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer group"
            onClick={() => openExplorer(nft.tokenId)}
          >
            {/* Artwork image from IPFS (via ipfs.io gateway) with placeholder fallback */}
            <div className={`aspect-square ${getTypeColor(nft.type)} flex items-center justify-center text-white/80 relative overflow-hidden`}>
              {(() => {
                const imageUrl = getImageUrl(nft);
                if (imageUrl) {
                  return (
                    <img
                      src={imageUrl}
                      alt={nft.name}
                      className="w-full h-full object-cover"
                      onError={() => handleImageError(nft.tokenId)}
                    />
                  );
                }
                return getIcon(nft.type);
              })()}
            </div>

            {/* Info */}
            <div className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium text-sm truncate" title={nft.name}>
                    {nft.name}
                  </h3>
                  <p className="text-gray-400 text-xs mt-1 line-clamp-2" title={nft.description}>
                    {nft.description}
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
              </div>

              <div className="mt-2">
                <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(nft.type)} text-white`}>
                  {nft.type}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
