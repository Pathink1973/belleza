import React, { useState } from 'react';

const accordionItems = [
  {
    id: 1,
    title: 'Barbearia',
    imageUrl: 'https://res.cloudinary.com/dfeqzodi3/image/upload/v1762640874/barbeiro_card.webp',
  },
  {
    id: 2,
    title: 'Cabelereira',
    imageUrl: 'https://res.cloudinary.com/dfeqzodi3/image/upload/v1762640874/cabeleireia_card.webp',
  },
  {
    id: 3,
    title: 'Massagens',
    imageUrl: 'https://res.cloudinary.com/dfeqzodi3/image/upload/v1762640875/massagens_card.webp',
  },
  {
    id: 4,
    title: 'Spa',
    imageUrl: 'https://res.cloudinary.com/dfeqzodi3/image/upload/v1762640878/spa_card.webp',
  },
  {
    id: 5,
    title: 'Fitness',
    imageUrl: 'https://res.cloudinary.com/dfeqzodi3/image/upload/v1762640874/fitness_card.webp',
  },
];

interface AccordionItemProps {
  item: typeof accordionItems[0];
  isActive: boolean;
  onMouseEnter: () => void;
}

const AccordionItem: React.FC<AccordionItemProps> = ({ item, isActive, onMouseEnter }) => {
  return (
    <div
      className={`
        relative h-[450px] rounded-2xl overflow-hidden cursor-pointer
        transition-all duration-700 ease-in-out
        ${isActive ? 'w-[400px]' : 'w-[60px]'}
      `}
      onMouseEnter={onMouseEnter}
    >
      <img
        src={item.imageUrl}
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.onerror = null;
          target.src = 'https://placehold.co/400x450/2d3748/ffffff?text=Image+Error';
        }}
      />
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>

      <span
        className={`
          absolute text-white text-lg font-semibold whitespace-nowrap
          transition-all duration-300 ease-in-out
          ${
            isActive
              ? 'bottom-6 left-1/2 -translate-x-1/2 rotate-0'
              : 'w-auto text-left bottom-24 left-1/2 -translate-x-1/2 rotate-90'
          }
        `}
      >
        {item.title}
      </span>
    </div>
  );
};

export function LandingAccordionItem() {
  const [activeIndex, setActiveIndex] = useState(2);

  const handleItemHover = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <div className="w-full">
      <div className="flex flex-row items-center justify-center gap-4 overflow-x-auto p-4">
        {accordionItems.map((item, index) => (
          <AccordionItem
            key={item.id}
            item={item}
            isActive={index === activeIndex}
            onMouseEnter={() => handleItemHover(index)}
          />
        ))}
      </div>
    </div>
  );
}
