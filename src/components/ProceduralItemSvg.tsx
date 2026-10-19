import React from 'react';
import {
  GeneratedGameItem,
  GardenStage,
  FishGrowthStage,
} from '../services/itemSystem';

interface ProceduralItemSvgProps {
  item: GeneratedGameItem;
  size?: number;
  gardenStage?: GardenStage; // Nếu truyền vào (0..4), vẽ cây theo từng giai đoạn phát triển
  fishStage?: FishGrowthStage; // Nếu truyền vào ('egg' | 'baby' | 'juvenile' | 'adult'), vẽ cá theo độ lớn
  className?: string;
}

export const ProceduralItemSvg: React.FC<ProceduralItemSvgProps> = ({
  item,
  size = 64,
  gardenStage,
  fishStage,
  className = '',
}) => {
  const { primaryColor, secondaryColor, accentColor, petalOrFinCount, shapeVariant, hasSparkle } =
    item.visual;

  // 1. VẼ HOA (Hoặc cây hoa theo 5 giai đoạn trong Vườn)
  if (item.category === 'flower') {
    const stage: GardenStage = gardenStage !== undefined ? gardenStage : 4;

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`overflow-visible select-none ${className}`}
        aria-label={item.name}
      >
        {/* Đất mềm dưới chậu */}
        <ellipse cx="50" cy="86" rx="28" ry="7" fill="#d9c2b2" opacity="0.7" />
        <ellipse cx="50" cy="86" rx="20" ry="4.5" fill="#bfa393" opacity="0.85" />

        {/* Giai đoạn 0: Hạt giống */}
        {stage === 0 && (
          <g>
            <ellipse
              cx="50"
              cy="80"
              rx="8"
              ry="6"
              fill={accentColor}
              stroke="#6e5849"
              strokeWidth="1.5"
            />
            <circle cx="48" cy="78" r="2" fill={secondaryColor} />
          </g>
        )}

        {/* Giai đoạn 1: Nảy mầm */}
        {stage === 1 && (
          <g>
            <path
              d="M50 85 Q50 70 50 64"
              stroke="#7cb374"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
            <ellipse
              cx="43"
              cy="64"
              rx="7"
              ry="4"
              transform="rotate(-25 43 64)"
              fill="#97cf8e"
            />
            <ellipse
              cx="57"
              cy="64"
              rx="7"
              ry="4"
              transform="rotate(25 57 64)"
              fill="#84bf7a"
            />
          </g>
        )}

        {/* Giai đoạn 2: Cây con */}
        {stage === 2 && (
          <g>
            <path
              d="M50 85 Q48 65 50 48"
              stroke="#6ca864"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <ellipse
              cx="40"
              cy="68"
              rx="10"
              ry="5"
              transform="rotate(-28 40 68)"
              fill="#8fcf88"
            />
            <ellipse
              cx="60"
              cy="62"
              rx="10"
              ry="5"
              transform="rotate(28 60 62)"
              fill="#7ebf77"
            />
            <ellipse
              cx="44"
              cy="50"
              rx="8"
              ry="4.5"
              transform="rotate(-18 44 50)"
              fill="#9ed998"
            />
          </g>
        )}

        {/* Giai đoạn 3: Kết nụ */}
        {stage === 3 && (
          <g>
            <path
              d="M50 85 Q47 62 50 38"
              stroke="#649e5c"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <ellipse
              cx="39"
              cy="66"
              rx="11"
              ry="5.5"
              transform="rotate(-28 39 66)"
              fill="#88c981"
            />
            <ellipse
              cx="61"
              cy="58"
              rx="11"
              ry="5.5"
              transform="rotate(28 61 58)"
              fill="#79ba72"
            />
            {/* Nụ hoa chúm chím */}
            <ellipse
              cx="50"
              cy="34"
              rx="9"
              ry="12"
              fill={primaryColor}
              stroke={accentColor}
              strokeWidth="1.5"
            />
            <path
              d="M42 40 Q50 34 58 40"
              fill="none"
              stroke="#649e5c"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Giai đoạn 4: Nở rộ lấp lánh */}
        {stage === 4 && (
          <g>
            <path
              d="M50 85 Q47 60 50 36"
              stroke="#649e5c"
              strokeWidth="4.2"
              strokeLinecap="round"
              fill="none"
            />
            <ellipse
              cx="38"
              cy="66"
              rx="11"
              ry="5.5"
              transform="rotate(-28 38 66)"
              fill="#88c981"
            />
            <ellipse
              cx="62"
              cy="60"
              rx="11"
              ry="5.5"
              transform="rotate(28 62 60)"
              fill="#79ba72"
            />

            {/* Cánh hoa sinh theo petalOrFinCount */}
            {Array.from({ length: petalOrFinCount }).map((_, idx) => {
              const angle = (360 / petalOrFinCount) * idx;
              const rx = shapeVariant % 2 === 0 ? 9 : 7.5;
              const ry = shapeVariant % 3 === 0 ? 16 : 14;
              return (
                <g
                  key={idx}
                  transform={`translate(50, 34) rotate(${angle})`}
                >
                  <ellipse
                    cx="0"
                    cy="-11"
                    rx={rx}
                    ry={ry}
                    fill={idx % 2 === 0 ? primaryColor : secondaryColor}
                    stroke={accentColor}
                    strokeWidth="1.2"
                  />
                </g>
              );
            })}

            {/* Nhụy hoa */}
            <circle
              cx="50"
              cy="34"
              r="8.5"
              fill="#fae28c"
              stroke={accentColor}
              strokeWidth="1.5"
            />
            <circle cx="48" cy="32" r="2.2" fill="#fffdf5" />

            {/* Hiệu ứng lấp lánh khi hoa nở */}
            <g className="animate-pulse">
              <path
                d="M22 20 L24 25 L29 27 L24 29 L22 34 L20 29 L15 27 L20 25 Z"
                fill={primaryColor}
              />
              <path
                d="M78 16 L79.5 20 L83.5 21.5 L79.5 23 L78 27 L76.5 23 L72.5 21.5 L76.5 20 Z"
                fill="#f5d469"
              />
              {hasSparkle && (
                <circle cx="50" cy="10" r="2.5" fill={accentColor} />
              )}
            </g>
          </g>
        )}
      </svg>
    );
  }

  // 2. VẼ CÁ (Hỗ trợ cả Trứng cá, Cá con, Cá nhỡ, Cá trưởng thành)
  if (item.category === 'fish') {
    const fStage: FishGrowthStage = fishStage || 'adult';

    if (fStage === 'egg') {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`overflow-visible select-none ${className}`}
          aria-label={item.name}
        >
          <circle
            cx="50"
            cy="52"
            r="22"
            fill={secondaryColor}
            stroke={primaryColor}
            strokeWidth="2.5"
            opacity="0.9"
          />
          <circle cx="52" cy="54" r="10" fill={primaryColor} />
          <circle cx="44" cy="44" r="4" fill="#ffffff" opacity="0.8" />
        </svg>
      );
    }

    const scale =
      fStage === 'baby' ? 0.68 : fStage === 'juvenile' ? 0.85 : 1;

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`overflow-visible select-none ${className}`}
        aria-label={item.name}
      >
        <g transform={`translate(50, 50) scale(${scale}) translate(-50, -50)`}>
          {/* Đuôi cá mềm mại */}
          <path
            d={
              shapeVariant % 2 === 0
                ? 'M26 50 L6 30 Q14 50 6 70 Z'
                : 'M26 50 C8 25, 4 42, 14 50 C4 58, 8 75, 26 50 Z'
            }
            fill={secondaryColor}
            stroke={accentColor}
            strokeWidth="1.5"
          />

          {/* Vây lưng & vây bụng */}
          <path
            d="M42 34 Q52 18 64 34"
            fill={secondaryColor}
            stroke={accentColor}
            strokeWidth="1.5"
          />
          <path
            d="M45 66 Q52 78 60 66"
            fill={secondaryColor}
            stroke={accentColor}
            strokeWidth="1.2"
          />

          {/* Thân cá */}
          <ellipse
            cx="54"
            cy="50"
            rx="28"
            ry="18"
            fill={primaryColor}
            stroke={accentColor}
            strokeWidth="1.8"
          />

          {/* Họa tiết vảy pastel */}
          <path
            d="M44 43 Q49 50 44 57"
            fill="none"
            stroke={secondaryColor}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M54 41 Q59 50 54 59"
            fill="none"
            stroke={secondaryColor}
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Mắt cá long lanh */}
          <circle cx="69" cy="46" r="4" fill="#3a2e35" />
          <circle cx="70.5" cy="44.5" r="1.4" fill="#ffffff" />
          {/* Má hồng */}
          <ellipse cx="66" cy="53" rx="3.5" ry="2" fill="#f28b9c" opacity="0.7" />
        </g>
      </svg>
    );
  }

  // 3. VẼ THÚ CƯNG
  if (item.category === 'pet') {
    const sp = (item.petSpecies || '').toLowerCase();
    const isBunny = sp.includes('thỏ');
    const isOwlOrBird = sp.includes('cú') || sp.includes('vẹt') || sp.includes('chim') || sp.includes('hạc') || sp.includes('thiên nga');

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`overflow-visible select-none ${className}`}
        aria-label={item.name}
      >
        {/* Bóng dưới chân */}
        <ellipse cx="50" cy="84" rx="24" ry="5" fill="#cbbab0" opacity="0.45" />

        {/* Tai thú cưng */}
        {isBunny ? (
          <g>
            <ellipse
              cx="38"
              cy="25"
              rx="6"
              ry="16"
              transform="rotate(-10 38 25)"
              fill={primaryColor}
              stroke={accentColor}
              strokeWidth="1.5"
            />
            <ellipse
              cx="38"
              cy="25"
              rx="3"
              ry="11"
              transform="rotate(-10 38 25)"
              fill={secondaryColor}
            />
            <ellipse
              cx="62"
              cy="25"
              rx="6"
              ry="16"
              transform="rotate(10 62 25)"
              fill={primaryColor}
              stroke={accentColor}
              strokeWidth="1.5"
            />
            <ellipse
              cx="62"
              cy="25"
              rx="3"
              ry="11"
              transform="rotate(10 62 25)"
              fill={secondaryColor}
            />
          </g>
        ) : !isOwlOrBird ? (
          <g>
            <polygon
              points="28,42 32,20 46,34"
              fill={primaryColor}
              stroke={accentColor}
              strokeWidth="1.5"
            />
            <polygon
              points="72,42 68,20 54,34"
              fill={primaryColor}
              stroke={accentColor}
              strokeWidth="1.5"
            />
          </g>
        ) : null}

        {/* Thân & đầu tròn bầu bĩnh */}
        <ellipse
          cx="50"
          cy="58"
          rx="26"
          ry="23"
          fill={primaryColor}
          stroke={accentColor}
          strokeWidth="1.8"
        />
        <ellipse cx="50" cy="63" rx="16" ry="13" fill={secondaryColor} />

        {/* Đôi mắt & biểu cảm đáng yêu */}
        <circle cx="40" cy="51" r="3.5" fill="#3a2e35" />
        <circle cx="41" cy="49.8" r="1.2" fill="#ffffff" />
        <circle cx="60" cy="51" r="3.5" fill="#3a2e35" />
        <circle cx="61" cy="49.8" r="1.2" fill="#ffffff" />

        {/* Má hồng */}
        <ellipse cx="34" cy="56" rx="4" ry="2.2" fill="#f28b9c" opacity="0.7" />
        <ellipse cx="66" cy="56" rx="4" ry="2.2" fill="#f28b9c" opacity="0.7" />

        {/* Mũi / Mỏ */}
        {isOwlOrBird ? (
          <polygon points="47,53 53,53 50,58" fill="#f0b45b" />
        ) : (
          <path
            d="M46 56 Q50 59 54 56"
            fill="none"
            stroke="#3a2e35"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}

        {hasSparkle && (
          <path
            d="M78 24 L80 28 L84 30 L80 32 L78 36 L76 32 L72 30 L76 28 Z"
            fill="#f5d469"
          />
        )}
      </svg>
    );
  }

  // 4. VẼ LY THỨC UỐNG
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`overflow-visible select-none ${className}`}
      aria-label={item.name}
    >
      {/* Ống hút pastel */}
      <path
        d="M58 18 L66 10 L70 12 L54 44"
        fill="none"
        stroke={accentColor}
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Thân ly thủy tinh */}
      <path
        d="M28 36 L33 82 Q50 88 67 82 L72 36 Z"
        fill={secondaryColor}
        stroke={accentColor}
        strokeWidth="2"
      />

      {/* Lớp nước thơm bên trong */}
      <path
        d="M30 46 L34 80 Q50 85 66 80 L70 46 Z"
        fill={primaryColor}
        opacity="0.9"
      />

      {/* Lớp kem bọt mềm trên miệng ly */}
      <ellipse
        cx="50"
        cy="36"
        rx="22"
        ry="7"
        fill="#fffdf9"
        stroke={accentColor}
        strokeWidth="1.6"
      />

      {/* Topping trân châu / thạch nhỏ */}
      <circle cx="42" cy="74" r="3" fill={accentColor} />
      <circle cx="50" cy="76" r="3" fill={accentColor} />
      <circle cx="58" cy="73" r="3" fill={accentColor} />

      {hasSparkle && (
        <path
          d="M22 24 L24 28 L28 30 L24 32 L22 36 L20 32 L16 30 L20 28 Z"
          fill="#f5d469"
        />
      )}
    </svg>
  );
};
