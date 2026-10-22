import React from 'react';
import {
  GeneratedGameItem,
  GardenStage,
  FishGrowthStage,
  ItemCategory,
  ItemRarity,
} from '../services/itemSystem';

function hashSeed(seedInput: string | number | null | undefined): number {
  const str = String(seedInput ?? 'default_seed');
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

const SEED_PALETTES: Array<{
  primary: string;
  secondary: string;
  accent: string;
  leafMain: string;
  leafAlt: string;
}> = [
  { primary: '#f4a3b0', secondary: '#fde2e6', accent: '#d97b8c', leafMain: '#7fc479', leafAlt: '#97d691' },
  { primary: '#8fcfbf', secondary: '#dcf5ee', accent: '#5ca896', leafMain: '#6eb88d', leafAlt: '#8cd4aa' },
  { primary: '#b8a6e0', secondary: '#ebe4fa', accent: '#8e77c4', leafMain: '#7db587', leafAlt: '#95cc9f' },
  { primary: '#f2cf7a', secondary: '#fbf0d1', accent: '#d9ab43', leafMain: '#84c272', leafAlt: '#9fd98e' },
  { primary: '#9cc7ee', secondary: '#e1f0fc', accent: '#6aa3d9', leafMain: '#73ba92', leafAlt: '#8fd1ac' },
  { primary: '#f7b299', secondary: '#fde8df', accent: '#d98266', leafMain: '#88bf73', leafAlt: '#a3d68e' },
  { primary: '#e8a5d3', secondary: '#faeaf5', accent: '#bf73a7', leafMain: '#78bd86', leafAlt: '#94d4a1' },
  { primary: '#a8d8a0', secondary: '#e6f7e3', accent: '#75ad6c', leafMain: '#66ad78', leafAlt: '#82c794' },
  { primary: '#f5c18c', secondary: '#fceddc', accent: '#cc9258', leafMain: '#7eb86e', leafAlt: '#99cf8a' },
  { primary: '#9ad4d6', secondary: '#e1f6f7', accent: '#63a6a8', leafMain: '#6eb58c', leafAlt: '#8bd1a8' },
];

export type ItemStageInput = GardenStage | FishGrowthStage | number | string | undefined;

export interface RenderItemOptions {
  size?: number;
  className?: string;
  label?: string;
  petSpeciesHint?: string;
  meta?: Record<string, unknown> | null;
}

/**
 * Bộ hàm vẽ SVG dùng chung theo seed (`renderItem(kind, seed, rarity, stage)`):
 * - hoa (flower): đổi màu cánh / số cánh / kiểu lá theo seed; 5 giai đoạn (0: hạt, 1: nảy mầm, 2: cây con, 3: nụ, 4: nở)
 * - cá (fish): đổi màu thân / đuôi / hoa văn theo seed; stage 'egg' (hoặc 0) là trứng, còn lại là cá bơi
 * - thú (pet): đổi loài (thỏ, mèo, cáo, cún, hươu, cú, sóc, gấu), màu lông, biểu cảm theo seed
 * - ly nước (drink): đổi màu đồ uống, kiểu ống hút, topping (trân châu, thạch đào, lát cam, kem bông, lá bạc hà) theo seed
 * - độ hiếm (rarity): có viền hoặc hiệu ứng lấp lánh dịu (rare / legendary)
 * Cùng một món (kind + seed + rarity) luôn ra cùng một hình ở mọi nơi.
 */
export function renderItem(
  kind: ItemCategory | string,
  seed: string | number | null | undefined,
  rarity: ItemRarity | string | null | undefined = 'common',
  stage?: ItemStageInput,
  options?: RenderItemOptions
): React.ReactElement {
  const rawKind = String(kind || 'flower').toLowerCase();
  const isSeedKind =
    rawKind === 'seed' || rawKind === 'hat_giong' || rawKind === 'hạt giống';
  const normalizedKind: ItemCategory =
    rawKind === 'fish' || rawKind === 'ca' || rawKind === 'cá'
      ? 'fish'
      : rawKind === 'pet' || rawKind === 'thu_cung' || rawKind === 'thú cưng'
      ? 'pet'
      : rawKind === 'drink' || rawKind === 'thuc_uong' || rawKind === 'thức uống'
      ? 'drink'
      : 'flower';

  const rawRarity = String(rarity || 'common').toLowerCase();
  const normalizedRarity: ItemRarity =
    rawRarity === 'legendary' || rawRarity === 'hiếm' || rawRarity === 'hiem'
      ? 'legendary'
      : rawRarity === 'rare' || rawRarity === 'quý' || rawRarity === 'quy'
      ? 'rare'
      : 'common';

  const size = options?.size ?? 64;
  const className = options?.className ?? '';
  const ariaLabel = options?.label ?? `${isSeedKind ? 'seed' : normalizedKind}_${String(seed ?? '')}`;

  const h = hashSeed(`${normalizedKind}_${String(seed ?? 'default')}`);
  const pal = SEED_PALETTES[h % SEED_PALETTES.length];
  const primaryColor = pal.primary;
  const secondaryColor = pal.secondary;
  const accentColor = pal.accent;
  const isRare = normalizedRarity === 'rare';
  const isLegendary = normalizedRarity === 'legendary';
  const hasSparkle = isRare || isLegendary;

  const renderRarityAuraAndSparkles = () => (
    <>
      {isLegendary && (
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#f5d469"
          strokeWidth="2.2"
          strokeDasharray="5 3"
          opacity="0.85"
        />
      )}
      {isRare && (
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={primaryColor}
          strokeWidth="1.6"
          strokeDasharray="3 4"
          opacity="0.65"
        />
      )}
      {hasSparkle && (
        <g className="animate-pulse">
          <path
            d="M18 20 L20 24.5 L24.5 26.5 L20 28.5 L18 33 L16 28.5 L11.5 26.5 L16 24.5 Z"
            fill={isLegendary ? '#f5d469' : primaryColor}
            opacity="0.9"
          />
          <path
            d="M82 18 L83.5 21.5 L87 23 L83.5 24.5 L82 28 L80.5 24.5 L77 23 L80.5 21.5 Z"
            fill="#f5d469"
            opacity="0.9"
          />
          {isLegendary && (
            <>
              <circle cx="24" cy="76" r="2.2" fill="#f5d469" />
              <circle cx="80" cy="72" r="2.5" fill={primaryColor} />
            </>
          )}
        </g>
      )}
    </>
  );

  // ==========================================================================
  // 1. VẼ HOA & HẠT GIỐNG (FLOWER / SEED) - Đổi màu cánh, số cánh (5..10), kiểu lá theo seed & 5 giai đoạn
  // ==========================================================================
  if (normalizedKind === 'flower') {
    let flowerStage: GardenStage = isSeedKind ? 0 : 4;
    if (typeof stage === 'number' && stage >= 0 && stage <= 4) {
      flowerStage = Math.floor(stage) as GardenStage;
    } else if (stage === 'seed') {
      flowerStage = 0;
    } else if (stage === 'sprout') {
      flowerStage = 1;
    } else if (stage === 'sapling') {
      flowerStage = 2;
    } else if (stage === 'bud') {
      flowerStage = 3;
    } else if (stage === 'bloom' || stage === 'adult') {
      flowerStage = 4;
    }

    const petalCount = 5 + ((h >> 3) % 6); // 5..10 cánh
    const petalShapeVariant = (h >> 6) % 3; // 0: tròn bầu, 1: thon dài, 2: tim dịu
    const leafVariant = (h >> 9) % 3; // 0: lá tròn, 1: lá nhọn, 2: lá kép
    const centerColor = (h >> 12) % 2 === 0 ? '#fae28c' : '#ffd1dc';

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`overflow-visible select-none ${className}`}
        aria-label={ariaLabel}
      >
        {renderRarityAuraAndSparkles()}

        {/* Mô đất mềm dưới gốc */}
        <ellipse cx="50" cy="86" rx="28" ry="7" fill="#d9c2b2" opacity="0.75" />
        <ellipse cx="50" cy="86" rx="20" ry="4.5" fill="#bfa393" opacity="0.88" />

        {/* Giai đoạn 0: Hạt giống */}
        {flowerStage === 0 && (
          <g>
            {/* Hạt giống tròn bầu mang sắc màu riêng của loài hoa */}
            <path
              d="M50 58 C61 62, 63 78, 50 82 C37 78, 39 62, 50 58 Z"
              fill={primaryColor}
              stroke={accentColor}
              strokeWidth="2"
            />
            <ellipse
              cx="46"
              cy="69"
              rx="3.5"
              ry="5.5"
              transform="rotate(-15 46 69)"
              fill={secondaryColor}
              opacity="0.85"
            />
            {/* Chồi mầm nhỏ xíu trên đỉnh hạt */}
            <path
              d="M50 58 Q52 50 56 48"
              stroke={pal.leafMain}
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
            <ellipse
              cx="57"
              cy="48"
              rx="4.5"
              ry="2.5"
              transform="rotate(-20 57 48)"
              fill={pal.leafAlt}
            />
          </g>
        )}

        {/* Giai đoạn 1: Nảy mầm */}
        {flowerStage === 1 && (
          <g>
            <path
              d="M50 85 Q50 70 50 63"
              stroke={pal.leafMain}
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
            <ellipse
              cx="43"
              cy="63"
              rx="7.5"
              ry="4.2"
              transform="rotate(-25 43 63)"
              fill={pal.leafAlt}
            />
            <ellipse
              cx="57"
              cy="63"
              rx="7.5"
              ry="4.2"
              transform="rotate(25 57 63)"
              fill={pal.leafMain}
            />
          </g>
        )}

        {/* Giai đoạn 2: Cây con */}
        {flowerStage === 2 && (
          <g>
            <path
              d="M50 85 Q48 65 50 48"
              stroke={pal.leafMain}
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <ellipse
              cx="40"
              cy="68"
              rx="10"
              ry={leafVariant === 1 ? 3.5 : 5}
              transform="rotate(-28 40 68)"
              fill={pal.leafAlt}
            />
            <ellipse
              cx="60"
              cy="62"
              rx="10"
              ry={leafVariant === 1 ? 3.5 : 5}
              transform="rotate(28 60 62)"
              fill={pal.leafMain}
            />
            <ellipse
              cx="44"
              cy="50"
              rx="8"
              ry="4.5"
              transform="rotate(-18 44 50)"
              fill={pal.leafAlt}
            />
          </g>
        )}

        {/* Giai đoạn 3: Kết nụ */}
        {flowerStage === 3 && (
          <g>
            <path
              d="M50 85 Q47 62 50 38"
              stroke={pal.leafMain}
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <ellipse
              cx="39"
              cy="66"
              rx="11"
              ry={leafVariant === 1 ? 4 : 5.5}
              transform="rotate(-28 39 66)"
              fill={pal.leafAlt}
            />
            <ellipse
              cx="61"
              cy="58"
              rx="11"
              ry={leafVariant === 1 ? 4 : 5.5}
              transform="rotate(28 61 58)"
              fill={pal.leafMain}
            />
            <ellipse
              cx="50"
              cy="34"
              rx="9.5"
              ry="12.5"
              fill={primaryColor}
              stroke={accentColor}
              strokeWidth="1.6"
            />
            <path
              d="M42 40 Q50 34 58 40"
              fill="none"
              stroke={pal.leafMain}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Giai đoạn 4: Hoa nở rộ */}
        {flowerStage === 4 && (
          <g>
            <path
              d="M50 85 Q47 60 50 36"
              stroke={pal.leafMain}
              strokeWidth="4.2"
              strokeLinecap="round"
              fill="none"
            />
            {/* Kiểu lá theo seed */}
            <ellipse
              cx="38"
              cy="66"
              rx={leafVariant === 0 ? 11.5 : 10}
              ry={leafVariant === 1 ? 3.8 : 5.8}
              transform="rotate(-28 38 66)"
              fill={pal.leafAlt}
            />
            <ellipse
              cx="62"
              cy="60"
              rx={leafVariant === 0 ? 11.5 : 10}
              ry={leafVariant === 1 ? 3.8 : 5.8}
              transform="rotate(28 62 60)"
              fill={pal.leafMain}
            />
            {leafVariant === 2 && (
              <ellipse
                cx="40"
                cy="53"
                rx="8.5"
                ry="4"
                transform="rotate(-20 40 53)"
                fill={pal.leafMain}
              />
            )}

            {/* Cánh hoa theo petalCount và petalShapeVariant */}
            {Array.from({ length: petalCount }).map((_, idx) => {
              const angle = (360 / petalCount) * idx;
              const rx = petalShapeVariant === 0 ? 9.5 : petalShapeVariant === 1 ? 6.8 : 8.5;
              const ry = petalShapeVariant === 0 ? 14.5 : petalShapeVariant === 1 ? 17 : 15.5;
              return (
                <g key={idx} transform={`translate(50, 34) rotate(${angle})`}>
                  <ellipse
                    cx="0"
                    cy="-11.5"
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
              r="8.8"
              fill={centerColor}
              stroke={accentColor}
              strokeWidth="1.5"
            />
            <circle cx="48" cy="32" r="2.3" fill="#fffdf5" />
          </g>
        )}
      </svg>
    );
  }

  // ==========================================================================
  // 2. VẼ CÁ (FISH) - Đổi màu thân, đuôi, hoa văn theo seed; chưa tới ready_at là trứng
  // ==========================================================================
  if (normalizedKind === 'fish') {
    const isEgg = stage === 'egg' || stage === 0 || stage === '0';

    if (isEgg) {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className={`overflow-visible select-none ${className}`}
          aria-label={ariaLabel}
        >
          {renderRarityAuraAndSparkles()}
          <ellipse cx="50" cy="84" rx="22" ry="5" fill="#9cc7ee" opacity="0.35" />
          <circle
            cx="50"
            cy="52"
            r="22"
            fill={secondaryColor}
            stroke={primaryColor}
            strokeWidth="2.5"
            opacity="0.92"
          />
          <circle cx="52" cy="54" r="10.5" fill={primaryColor} />
          <circle cx="48" cy="51" r="4" fill={accentColor} opacity="0.65" />
          <circle cx="43" cy="43" r="4.2" fill="#ffffff" opacity="0.85" />
        </svg>
      );
    }

    const tailStyle = (h >> 3) % 3; // 0: đuôi quạt, 1: đuôi lụa kép, 2: đuôi trăng khuyết
    const patternStyle = (h >> 6) % 3; // 0: vảy cong, 1: đốm chấm bi, 2: sọc lượn sóng
    const scale = stage === 'baby' ? 0.72 : stage === 'juvenile' ? 0.86 : 1;

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`overflow-visible select-none ${className}`}
        aria-label={ariaLabel}
      >
        {renderRarityAuraAndSparkles()}
        <g transform={`translate(50, 50) scale(${scale}) translate(-50, -50)`}>
          {/* Đuôi cá theo seed */}
          <path
            d={
              tailStyle === 0
                ? 'M26 50 L6 28 Q15 50 6 72 Z'
                : tailStyle === 1
                ? 'M26 50 C6 22, 2 42, 15 50 C2 58, 6 78, 26 50 Z'
                : 'M26 50 Q8 30 10 24 Q18 46 26 50 Q18 54 10 76 Q8 70 26 50 Z'
            }
            fill={secondaryColor}
            stroke={accentColor}
            strokeWidth="1.6"
          />

          {/* Vây lưng & vây bụng */}
          <path
            d={
              tailStyle === 1
                ? 'M38 34 Q50 14 66 34'
                : 'M42 34 Q52 20 64 34'
            }
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

          {/* Hoa văn thân cá theo seed */}
          {patternStyle === 0 && (
            <>
              <path
                d="M43 43 Q48 50 43 57"
                fill="none"
                stroke={secondaryColor}
                strokeWidth="2.3"
                strokeLinecap="round"
              />
              <path
                d="M53 41 Q58 50 53 59"
                fill="none"
                stroke={secondaryColor}
                strokeWidth="2.3"
                strokeLinecap="round"
              />
            </>
          )}
          {patternStyle === 1 && (
            <>
              <circle cx="44" cy="46" r="3.2" fill={secondaryColor} />
              <circle cx="53" cy="54" r="3.8" fill={secondaryColor} />
              <circle cx="48" cy="56" r="2.4" fill={accentColor} opacity="0.6" />
              <circle cx="56" cy="44" r="2.6" fill={secondaryColor} />
            </>
          )}
          {patternStyle === 2 && (
            <>
              <path
                d="M36 46 Q48 41 60 46"
                fill="none"
                stroke={secondaryColor}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M38 54 Q50 49 60 54"
                fill="none"
                stroke={secondaryColor}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Mắt cá long lanh & má hồng */}
          <circle cx="69" cy="46" r="4" fill="#3a2e35" />
          <circle cx="70.5" cy="44.5" r="1.4" fill="#ffffff" />
          <ellipse cx="66" cy="53" rx="3.5" ry="2" fill="#f28b9c" opacity="0.75" />
        </g>
      </svg>
    );
  }

  // ==========================================================================
  // 3. VẼ THÚ CƯNG (PET) - Đổi loài, màu lông, biểu cảm theo seed
  // ==========================================================================
  if (normalizedKind === 'pet') {
    const hint = (options?.petSpeciesHint || String(seed || '')).toLowerCase();
    // 5 nhóm hình dáng loài theo seed hoặc tên loài:
    // 0: Mèo/Cáo tai nhọn, 1: Thỏ tai dài, 2: Gấu/Hamster/Cừu tai tròn, 3: Hươu sừng nhỏ, 4: Cú/Chim cánh nhỏ
    let speciesArchetype = (h >> 2) % 5;
    if (hint.includes('thỏ')) speciesArchetype = 1;
    else if (hint.includes('hươu')) speciesArchetype = 3;
    else if (
      hint.includes('cú') ||
      hint.includes('chim') ||
      hint.includes('vẹt') ||
      hint.includes('hạc') ||
      hint.includes('thiên nga')
    )
      speciesArchetype = 4;
    else if (
      hint.includes('gấu') ||
      hint.includes('hamster') ||
      hint.includes('cừu') ||
      hint.includes('nhím') ||
      hint.includes('rái cá') ||
      hint.includes('chồn') ||
      hint.includes('cún')
    )
      speciesArchetype = 2;
    else if (hint.includes('mèo') || hint.includes('cáo') || hint.includes('hồ ly') || hint.includes('sói'))
      speciesArchetype = 0;

    // 3 kiểu biểu cảm theo seed: 0: mắt tròn long lanh, 1: mắt cười híp mí, 2: mắt nháy tinh nghịch
    const expressionStyle = (h >> 6) % 3;

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`overflow-visible select-none ${className}`}
        aria-label={ariaLabel}
      >
        {renderRarityAuraAndSparkles()}

        {/* Bóng dưới chân */}
        <ellipse cx="50" cy="84" rx="24" ry="5" fill="#cbbab0" opacity="0.45" />

        {/* Đuôi bông phía sau */}
        {speciesArchetype !== 1 && speciesArchetype !== 4 && (
          <path
            d="M70 68 Q88 58 84 44 Q78 40 72 56"
            fill={primaryColor}
            stroke={accentColor}
            strokeWidth="1.5"
          />
        )}
        {speciesArchetype === 1 && (
          <circle
            cx="75"
            cy="68"
            r="6.5"
            fill={secondaryColor}
            stroke={accentColor}
            strokeWidth="1.4"
          />
        )}

        {/* Tai / Sừng theo loài */}
        {speciesArchetype === 1 ? (
          // Thỏ tai dài
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
        ) : speciesArchetype === 3 ? (
          // Hươu sừng nhỏ
          <g>
            <path
              d="M38 36 L34 22 M35 27 L30 25"
              stroke="#b88b68"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <path
              d="M62 36 L66 22 M65 27 L70 25"
              stroke="#b88b68"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <ellipse cx="31" cy="39" rx="6" ry="3.5" transform="rotate(-20 31 39)" fill={primaryColor} />
            <ellipse cx="69" cy="39" rx="6" ry="3.5" transform="rotate(20 69 39)" fill={primaryColor} />
          </g>
        ) : speciesArchetype === 2 ? (
          // Tai tròn (Gấu / Hamster / Cừu / Cún)
          <g>
            <circle cx="32" cy="36" r="7.5" fill={primaryColor} stroke={accentColor} strokeWidth="1.5" />
            <circle cx="32" cy="36" r="3.8" fill={secondaryColor} />
            <circle cx="68" cy="36" r="7.5" fill={primaryColor} stroke={accentColor} strokeWidth="1.5" />
            <circle cx="68" cy="36" r="3.8" fill={secondaryColor} />
          </g>
        ) : speciesArchetype === 0 ? (
          // Tai nhọn (Mèo / Cáo / Hồ ly)
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

        {/* Đôi cánh nhỏ nếu là Cú / Chim */}
        {speciesArchetype === 4 && (
          <g>
            <path
              d="M25 56 Q10 44 16 64 Q20 68 27 64"
              fill={secondaryColor}
              stroke={accentColor}
              strokeWidth="1.4"
            />
            <path
              d="M75 56 Q90 44 84 64 Q80 68 73 64"
              fill={secondaryColor}
              stroke={accentColor}
              strokeWidth="1.4"
            />
          </g>
        )}

        {/* Thân & đầu bầu bĩnh */}
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

        {/* Biểu cảm đôi mắt theo seed */}
        {expressionStyle === 1 ? (
          // Mắt cười híp mí hạnh phúc
          <g>
            <path
              d="M35 51 Q40 45 45 51"
              fill="none"
              stroke="#3a2e35"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
            <path
              d="M55 51 Q60 45 65 51"
              fill="none"
              stroke="#3a2e35"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
          </g>
        ) : expressionStyle === 2 ? (
          // Mắt nháy tinh nghịch
          <g>
            <path
              d="M36 51 Q40 46 44 51"
              fill="none"
              stroke="#3a2e35"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
            <circle cx="60" cy="51" r="3.6" fill="#3a2e35" />
            <circle cx="61.2" cy="49.8" r="1.3" fill="#ffffff" />
          </g>
        ) : (
          // Mắt tròn long lanh
          <g>
            <circle cx="40" cy="51" r="3.6" fill="#3a2e35" />
            <circle cx="41.2" cy="49.8" r="1.3" fill="#ffffff" />
            <circle cx="60" cy="51" r="3.6" fill="#3a2e35" />
            <circle cx="61.2" cy="49.8" r="1.3" fill="#ffffff" />
          </g>
        )}

        {/* Má hồng */}
        <ellipse cx="34" cy="56" rx="4" ry="2.2" fill="#f28b9c" opacity="0.72" />
        <ellipse cx="66" cy="56" rx="4" ry="2.2" fill="#f28b9c" opacity="0.72" />

        {/* Mũi / miệng */}
        {speciesArchetype === 4 ? (
          <polygon points="47,53 53,53 50,58" fill="#f0b45b" />
        ) : (
          <path
            d="M46 56 Q50 59.5 54 56"
            fill="none"
            stroke="#3a2e35"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    );
  }

  // ==========================================================================
  // 4. VẼ LY THỨC UỐNG (DRINK) - Đổi màu đồ uống, ống hút, topping theo seed & meta công thức
  // ==========================================================================
  const metaObj =
    options?.meta && typeof options.meta === 'object' ? options.meta : null;
  const metaColor =
    metaObj && typeof metaObj.color === 'string' && metaObj.color.trim()
      ? metaObj.color.trim()
      : null;
  const metaTopping =
    metaObj && typeof metaObj.topping === 'string'
      ? metaObj.topping.toLowerCase()
      : '';
  const drinkLiquidColor = metaColor || primaryColor;

  const strawStyle = (h >> 3) % 3; // 0: ống hút nghiêng phải, 1: ống hút nghiêng trái, 2: ống hút xoắn kẻ
  let toppingStyle = (h >> 6) % 4; // 0: trân châu, 1: mật ong / thạch đào, 2: hoa khô / lát cam & lá bạc hà, 3: kem mây / kem bông
  if (metaTopping.includes('trân châu') || metaTopping.includes('tran chau')) {
    toppingStyle = 0;
  } else if (metaTopping.includes('mật ong') || metaTopping.includes('mat ong') || metaTopping.includes('thạch')) {
    toppingStyle = 1;
  } else if (metaTopping.includes('hoa khô') || metaTopping.includes('hoa kho') || metaTopping.includes('cam')) {
    toppingStyle = 2;
  } else if (metaTopping.includes('kem mây') || metaTopping.includes('kem may') || metaTopping.includes('kem')) {
    toppingStyle = 3;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`overflow-visible select-none ${className}`}
      aria-label={ariaLabel}
    >
      {renderRarityAuraAndSparkles()}

      {/* Ống hút theo seed */}
      {strawStyle === 0 && (
        <path
          d="M58 18 L66 10 L70 12 L54 44"
          fill="none"
          stroke={accentColor}
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}
      {strawStyle === 1 && (
        <path
          d="M42 18 L34 10 L30 12 L46 44"
          fill="none"
          stroke={drinkLiquidColor}
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}
      {strawStyle === 2 && (
        <path
          d="M56 14 L62 10 L52 44"
          fill="none"
          stroke={accentColor}
          strokeWidth="4.2"
          strokeDasharray="4 2"
          strokeLinecap="round"
        />
      )}

      {/* Thân ly thủy tinh */}
      <path
        d="M28 36 L33 82 Q50 88 67 82 L72 36 Z"
        fill={secondaryColor}
        stroke={accentColor}
        strokeWidth="2"
      />

      {/* Lớp nước thơm bên trong theo màu công thức hoặc seed */}
      <path
        d="M30 45 L34 80 Q50 85 66 80 L70 45 Z"
        fill={drinkLiquidColor}
        opacity="0.92"
      />

      {/* Lớp kem bọt trên miệng ly */}
      <ellipse
        cx="50"
        cy="36"
        rx="22"
        ry="7"
        fill="#fffdf9"
        stroke={accentColor}
        strokeWidth="1.6"
      />

      {/* Topping đa dạng theo công thức hoặc seed */}
      {toppingStyle === 0 && (
        <g>
          {/* Trân châu */}
          <circle cx="41" cy="74" r="3.4" fill="#4a3531" />
          <circle cx="50" cy="76" r="3.4" fill="#4a3531" />
          <circle cx="59" cy="73" r="3.4" fill="#4a3531" />
          <circle cx="46" cy="69" r="2.8" fill="#5e433e" opacity="0.85" />
          <circle cx="54" cy="70" r="2.6" fill="#5e433e" opacity="0.85" />
        </g>
      )}
      {toppingStyle === 1 && (
        <g>
          {/* Mật ong óng ánh & thạch đào */}
          <path
            d="M35 37 Q42 44 49 37 Q56 45 64 37"
            fill="none"
            stroke="#e8a938"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <rect x="38" y="69" width="6" height="6" rx="1.5" fill="#fffdf5" opacity="0.9" />
          <rect x="48" y="71" width="6" height="6" rx="1.5" fill="#f2b857" />
          <rect x="56" y="67" width="5.5" height="5.5" rx="1.5" fill="#fffdf5" opacity="0.9" />
        </g>
      )}
      {toppingStyle === 2 && (
        <g>
          {/* Hoa khô / Lát cam vàng & lá bạc hà */}
          <circle cx="63" cy="33" r="6.5" fill="#f7b267" stroke="#e08e45" strokeWidth="1.4" />
          <circle cx="46" cy="34" r="3" fill="#f291a3" />
          <circle cx="52" cy="35" r="2.4" fill="#f5cf67" />
          <ellipse cx="38" cy="33" rx="6" ry="3" transform="rotate(-20 38 33)" fill="#7fc479" />
        </g>
      )}
      {toppingStyle === 3 && (
        <g>
          {/* Kem mây bồng bềnh và quả cherry đỏ trên miệng ly */}
          <path
            d="M34 36 Q42 22 50 28 Q58 22 66 36"
            fill="#fffdf9"
            stroke={accentColor}
            strokeWidth="1.5"
          />
          <circle cx="50" cy="24" r="3.8" fill="#e05a6d" />
        </g>
      )}
    </svg>
  );
}

interface ProceduralItemSvgProps {
  item: GeneratedGameItem & { seed?: string | number | null };
  size?: number;
  gardenStage?: GardenStage;
  fishStage?: FishGrowthStage;
  className?: string;
}

export const ProceduralItemSvg: React.FC<ProceduralItemSvgProps> = ({
  item,
  size = 64,
  gardenStage,
  fishStage,
  className = '',
}) => {
  const seedVal = item.seed || item.name || item.id;
  const stage: ItemStageInput =
    item.category === 'flower'
      ? gardenStage !== undefined
        ? gardenStage
        : 4
      : item.category === 'fish'
      ? fishStage !== undefined
        ? fishStage
        : 'adult'
      : undefined;

  return renderItem(item.category, seedVal, item.rarity, stage, {
    size,
    className,
    label: item.name,
    petSpeciesHint: item.petSpecies || item.name,
    meta: item.meta,
  });
};
