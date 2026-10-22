/**
 * Hệ thống Văn phong theo Tag ("tag_voices") & Thú cưng theo Tag ("tag_pets")
 * dành cho Phòng Tri Kỷ và Gacha của "Góc Nhỏ Lấp Lánh".
 *
 * - Ít nhất 25+ tag phổ biến, mỗi giọng có 15 câu thoại chia theo 6 tình huống:
 *   greeting (chào), gift_flower (được tặng hoa), gift_drink (được tặng nước),
 *   chat (trò chuyện), farewell (tạm biệt), high_bond (gắn bó cao).
 * - Char có nhiều tag sẽ trộn giọng của 2-3 tag đầu.
 * - Tag lạ hoặc tag tùy chỉnh sẽ đoán giọng theo từ khóa, nếu không đoán được thì dùng giọng trung tính dịu.
 * - Ghi chú dưới thú cưng CHỈ nói về VIBE và TÍNH CÁCH của thú, TUYỆT ĐỐI KHÔNG nhắc tên char.
 */

import { dataStore } from './dataLayer';

export type DialogueSituation =
  | 'greeting'
  | 'gift_flower'
  | 'gift_drink'
  | 'chat'
  | 'farewell'
  | 'high_bond';

export type SentenceLengthStyle = 'short' | 'medium' | 'long';

export interface TagVoiceDialogues {
  greeting: string[];
  gift_flower: string[];
  gift_drink: string[];
  chat: string[];
  farewell: string[];
  high_bond: string[];
}

export interface TagVoiceProfile {
  id: string;
  tag: string;
  keywords: string[];
  pronouns: string; // Cách xưng hô (VD: "mình - bạn", "ta - người", "tôi - cậu")
  rhythm: string; // Nhịp câu & sắc thái
  sentenceEnding: string; // Đuôi câu đặc trưng (VD: "nhé, nha", "đấy, hừm")
  emojis: string[];
  lengthStyle: SentenceLengthStyle;
  dialogues: TagVoiceDialogues;
}

export type PetBehaviorStyle =
  | 'gentle_sway' // Đi khoan thai, nhịp nhàng (dịu dàng, chữa lành)
  | 'calm_slow' // Đi chậm rãi, ít nhảy (lạnh lùng, trầm lặng)
  | 'playful_bouncy' // Nhún nhảy tinh nghịch (hài hước, tinh nghịch)
  | 'mystic_float' // Lướt êm huyền ảo (bí ẩn, kỳ ảo, cổ trang)
  | 'energetic_dash'; // Chạy lon ton năng động (tsundere, năng động)

export interface TagPetProfile {
  id: string;
  tag: string;
  keywords: string[];
  speciesList: string[];
  personality: string;
  behaviorStyle: PetBehaviorStyle;
  sounds: string[];
  vibeNote: string; // Ghi chú dưới thú cưng: chỉ nói về VIBE và TÍNH CÁCH, tuyệt đối không có tên char
}

export interface PersistedPetTrait {
  petSpecies: string;
  matchedTag: string;
  personality: string;
  behaviorStyle: PetBehaviorStyle;
  sound: string;
  vibeReason: string;
}

const PET_TRAITS_STORAGE_KEY = 'pet_assigned_traits_v2';

// ============================================================================
// GIỌNG TRUNG TÍNH DỊU (FALLBACK KHI KHÔNG ĐOÁN ĐƯỢC TAG)
// ============================================================================
export const NEUTRAL_GENTLE_VOICE: TagVoiceProfile = {
  id: 'voice_neutral_gentle',
  tag: 'Trung tính dịu',
  keywords: ['trung tính', 'mặc định', 'dịu', 'hiền'],
  pronouns: 'mình - bạn',
  rhythm: 'Nhẹ nhàng, lịch sự, nhịp điệu vừa phải và chân thành',
  sentenceEnding: 'nhé, nha, đó',
  emojis: ['🌸', '✨', '🍃'],
  lengthStyle: 'medium',
  dialogues: {
    greeting: [
      'Chào bạn nhé, hôm nay ghé căn phòng nhỏ có thấy lòng nhẹ nhàng hơn chút nào không? 🌸',
      'Bạn đến rồi à, ngồi xuống đây nghỉ chân một lát cho đỡ mỏi nhé ✨',
      'Rất vui được gặp lại bạn ở góc nhỏ yên bình này 🍃',
    ],
    gift_flower: [
      'Cảm ơn bạn vì đóa {item} thật xinh nhé, hương hoa làm căn phòng dịu hẳn đi 🌸',
      'Bạn khéo chọn quá, đóa {item} này mình sẽ cắm ở góc bàn gần cửa sổ nha ✨',
    ],
    gift_drink: [
      'Một ly {item} thơm dịu đúng lúc quá, cảm ơn bạn đã pha cho mình nhé ☕',
      'Thưởng thức {item} trong không gian yên tĩnh thế này thật dễ chịu biết bao ✨',
    ],
    chat: [
      'Dạo này công việc và cuộc sống của bạn thế nào, có điều gì muốn kể mình nghe không? 🌸',
      'Ngoài kia dù có bận rộn đến đâu, về tới góc nhỏ này thì cứ thong thả thôi nhé 🍃',
      'Ngồi nghe tiếng gió nhẹ qua khung cửa sổ thế này cũng đủ thấy bình yên rồi ✨',
      'Mình luôn ở đây lắng nghe mọi câu chuyện nhỏ trong ngày của bạn nha 🌸',
    ],
    farewell: [
      'Khi nào rảnh lại ghé chơi nhé, chúc bạn một ngày thật êm đềm 🌸',
      'Tạm biệt bạn nha, nhớ giữ gìn sức khỏe và ngủ thật ngon giấc nhé ✨',
    ],
    high_bond: [
      'Ở bên bạn lâu rồi, mỗi lần nghe tiếng bước chân quen thuộc là lòng mình lại thấy thật ấm áp 💗',
      'Cảm ơn bạn vì đã luôn kiên nhẫn và dịu dàng đồng hành cùng mình qua bao ngày tháng 🌸',
      'Giữa muôn vàn điều đổi thay, góc nhỏ này vẫn luôn dành trọn sự bình yên nhất đợi bạn trở về ✨',
    ],
  },
};

// ============================================================================
// DANH SÁCH 26+ TAG PHỔ BIẾN -> GIỌNG NÓI (MỖI GIỌNG ~15 CÂU THOẠI)
// ============================================================================
export const DEFAULT_TAG_VOICES: TagVoiceProfile[] = [
  {
    id: 'voice_diu_dang',
    tag: 'Dịu dàng',
    keywords: ['dịu dàng', 'mềm mại', 'hiền dịu', 'dịu êm', 'nhẹ nhàng', 'thùy mị'],
    pronouns: 'mình - bạn',
    rhythm: 'Nói nhẹ, ấm áp, nhịp câu êm ái, hay ân cần hỏi han',
    sentenceEnding: 'nhé, nha, đó, nè',
    emojis: ['🌸', '🌷', '🍵', '💕'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Bạn đến rồi đó ư? Ngoài trời có lạnh không, lại đây ngồi gần đèn cho ấm tay nhé 🌸',
        'Chào bạn nha, hôm nay của bạn thế nào, có mệt lắm không? Kể mình nghe với nhé 🌷',
        'Nghe tiếng cửa khẽ mở là mình biết ngay bạn ghé thăm, mình vừa pha trà ấm đợi bạn nè 🍵',
      ],
      gift_flower: [
        'Ôi, đóa {item} mềm mại và thơm dịu quá... Cảm ơn bạn đã luôn nhớ mang hoa về cho mình nhé 🌸',
        'Nhìn những cánh {item} này mình lại nghĩ đến sự ân cần của bạn. Mình sẽ giữ gìn thật kỹ nha 🌷',
      ],
      gift_drink: [
        'Ly {item} còn ấm nóng trên tay làm lòng mình xao xuyến quá. Bạn cũng uống cùng mình một ngụm nhé 🍵',
        'Vị của {item} dịu ngọt vừa vặn lắm, cảm ơn bạn đã luôn chu đáo với mình như vậy nha 💕',
      ],
      chat: [
        'Đừng cố gồng mình quá sức nhé, nếu hôm nay có chút mỏi mệt thì cứ tựa vào đây nghỉ ngơi một lát 🌸',
        'Mình thích nhất là những buổi tối yên ả thế này, được lắng nghe giọng nói và tâm sự của bạn 🌷',
        'Bàn tay bạn hôm nay có vẻ hơi lạnh nè, nhớ mặc thêm áo ấm và uống nước ấm đều đặn nhé 🍵',
        'Chỉ cần thấy bạn mỉm cười nhẹ nhõm là cả ngày hôm nay của mình cũng trở nên trọn vẹn rồi 💕',
      ],
      farewell: [
        'Bạn về nghỉ ngơi nhé, chúc bạn đêm nay có những giấc mơ thật ngọt ngào và êm ái 🌸',
        'Mình sẽ luôn giữ ngọn đèn nhỏ ấm áp ở đây, mai rảnh lại ghé trò chuyện cùng mình nha 🌷',
      ],
      high_bond: [
        'Thật kỳ diệu khi giữa bao nhiêu người, chúng mình lại tìm thấy sự đồng điệu dịu dàng đến thế này 💕',
        'Dù ngày mai có mưa giông hay nắng gắt, hãy nhớ là luôn có một người thương bạn bằng cả sự dịu êm nhất 🌸',
        'Ở bên bạn, mình chẳng cần mong cầu gì hơn ngoài những khoảnh khắc bình yên nối dài mãi mãi 🌷',
      ],
    },
  },
  {
    id: 'voice_lanh_lung',
    tag: 'Lạnh lùng',
    keywords: ['lạnh lùng', 'băng giá', 'kiệm lời', 'ít nói', 'điềm tĩnh', 'lạnh nhạt', 'cao lãnh'],
    pronouns: 'tôi - cậu / ta - ngươi',
    rhythm: 'Câu ngắn gọn, tiết chế cảm xúc, nhưng thỉnh thoảng lộ chút quan tâm kín đáo',
    sentenceEnding: 'đấy, thôi, ừm, .',
    emojis: ['❄️', '🌙', '🍵'],
    lengthStyle: 'short',
    dialogues: {
      greeting: [
        'Đến rồi à. Ngồi đi, ngoài kia gió không nhỏ đâu. ❄️',
        'Ừm. Tôi biết cậu sẽ ghé qua vào giờ này. 🌙',
        'Vào đi. Khăn ấm để sẵn trên ghế kia kìa. 🍵',
      ],
      gift_flower: [
        '{item} sao? Mùi hương không tệ... Cảm ơn, tôi sẽ để trên bàn đọc sách. ❄️',
        'Cậu tự tay trồng đóa {item} này à? Cũng có chút tâm ý đấy. 🌙',
      ],
      gift_drink: [
        '{item} vừa đủ độ ấm. Cậu nhớ khẩu vị của tôi kỹ hơn tôi tưởng đấy. 🍵',
        'Cảm ơn vì ly {item}. Đừng nhìn tôi chằm chằm thế, chỉ là hơi hợp vị thôi. ❄️',
      ],
      chat: [
        'Không cần cố tìm chủ đề đâu. Ngồi im lặng thế này một lát cũng tốt. 🌙',
        'Trông sắc mặt cậu hơi mỏi. Đừng thức khuya quá, không ai khen đâu. ❄️',
        'Tôi vốn không quen nói lời hoa mỹ. Nhưng cậu ở đây... không hề phiền chút nào. 🍵',
        'Gió đêm bắt đầu lạnh hơn rồi. Kéo cao cổ áo lên đi. 🌙',
      ],
      farewell: [
        'Về đi. Đường tối, nhìn đường cẩn thận. ❄️',
        'Ừm, mai gặp lại. Đừng quên lời tôi dặn về việc nghỉ ngơi sớm. 🌙',
      ],
      high_bond: [
        'Tôi đã quen với sự cô độc từ rất lâu... cho đến khi cậu cứ thế bước vào và ở lại. ❄️',
        'Chỉ với riêng cậu, tôi mới không muốn giữ khoảng cách lạnh giá này nữa. Ở lại thêm chút đi. 🌙',
        'Nếu thế giới ngoài kia làm cậu mệt mỏi, cứ lùi về phía sau lưng tôi. Tôi giữ chỗ cho cậu rồi. 🍵',
      ],
    },
  },
  {
    id: 'voice_hai_huoc',
    tag: 'Hài hước',
    keywords: ['hài hước', 'vui nhộn', 'dí dỏm', 'lầy lội', 'tấu hài', 'vui tính', 'hóm hỉnh'],
    pronouns: 'tui - đằng ấy / mình - cậu',
    rhythm: 'Rộn ràng, hay đùa duyên, chơi chữ nhẹ nhàng, truyền năng lượng tích cực',
    sentenceEnding: 'haha, luôn á, nha quý vị, đó nghen',
    emojis: ['😆', '🎉', '✨', '🥨'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Á à! Nhân vật chính của ngày hôm nay đã xuất hiện rồi đây, trải thảm đỏ đón đằng ấy luôn! 🎉',
        'Đang tính bói xem bao giờ cậu ghé thì cậu bước vào liền, tâm linh tương thông dữ thần chưa 😆',
        'Chào mừng quý khách ghé thăm trạm phát sóng tiếng cười không giới hạn của tui nha ✨',
      ],
      gift_flower: [
        'Oa, tặng tui đóa {item} đẹp cỡ này là tính làm tui cảm động rơi nước mắt thành suối luôn hả? 😆',
        'Hoa {item} thì thơm, mà người tặng hoa thì mười điểm không có nhưng luôn nha! 🎉',
      ],
      gift_drink: [
        'Một ly {item} cứu đói khát kịp thời! Tui xin phong tặng đằng ấy danh hiệu Thiên thần Pha chế ✨',
        'Uống ngụm {item} này xong là năng lượng tấu hài của tui lại đầy bình 200% liền nha 🥨',
      ],
      chat: [
        'Hôm nay có ai bắt nạt đằng ấy không? Nói nhỏ tui nghe để tui... pha trò chọc cho cậu cười quên luôn 😆',
        'Người ta nói một nụ cười bằng mười thang thuốc bổ, ngồi với tui nãy giờ là cậu lời nguyên tiệm thuốc rồi đó 🎉',
        'Đừng nhăn trán nữa mà, nhăn là mất hết vẻ đẹp nghiêng nước nghiêng thùng đó nghen ✨',
        'Bí quyết sống vui của tui đơn giản lắm: ăn no, ngủ kỹ và mỗi ngày đợi đằng ấy ghé tám chuyện! 🥨',
      ],
      farewell: [
        'Tạm biệt nha! Về nhớ cười tươi chứ đừng để mặt nghiêm trọng như đi họp quốc hội nghen 😆',
        'Bye bye đằng ấy, mai nhớ ghé đúng giờ để nghe tui kể tập tiếp theo của chuyện hài hôm nay nha! 🎉',
      ],
      high_bond: [
        'Bình thường tui hay đùa giỡn vậy thôi, chứ việc thương quý và trân trọng đằng ấy là thật 100% không pha ke nha 💗',
        'Cảm ơn cậu vì đã luôn bật cười trước những câu đùa ngốc nghếch của tui, ở bên cậu vui nhất trên đời luôn ✨',
        'Dù sau này có chuyện gì xảy ra, tui cũng nguyện làm người chọc cho đằng ấy mỉm cười mỗi ngày! 🎉',
      ],
    },
  },
  {
    id: 'voice_chua_lanh',
    tag: 'Chữa lành',
    keywords: ['chữa lành', 'an ủi', 'ỗ dành', 'tĩnh tâm', 'xoa dịu', 'thư giãn', 'healing'],
    pronouns: 'mình - bạn',
    rhythm: 'Chậm rãi, vỗ về, giàu sự thấu cảm và nâng niu cảm xúc',
    sentenceEnding: 'nhé, bạn thương, thôi mà, nha',
    emojis: ['🌿', '🕯️', '🍵', '🤍'],
    lengthStyle: 'long',
    dialogues: {
      greeting: [
        'Chào bạn thương, hãy thở ra một hơi thật nhẹ và để lại mọi âu lo ngoài bậc cửa nhé 🌿',
        'Bạn đã vất vả cả ngày dài rồi, về đến đây là an toàn và bình yên rồi đó 🕯️',
        'Ngồi xuống chiếc đệm mềm này đi, mình vừa thắp một chút nến thơm hương gỗ dịu cho bạn thư giãn nè 🤍',
      ],
      gift_flower: [
        'Đóa {item} này mang sức sống thật hiền hòa... Cảm ơn bạn đã gieo trồng bằng cả sự kiên nhẫn và trao cho mình 🌿',
        'Ngắm nhìn từng cánh {item}, mình cảm nhận được trái tim ấm áp của bạn đang tỏa hương dịu dàng lắm 🤍',
      ],
      gift_drink: [
        'Hơi ấm từ ly {item} lan tỏa qua đầu ngón tay thật dễ chịu. Cảm ơn bạn đã mang sự ngọt lành này đến cho mình 🍵',
        'Nhấp một ngụm {item} chậm rãi thôi nhé, để vị thơm êm ái vỗ về tâm trí bạn lúc này 🕯️',
      ],
      chat: [
        'Không sao cả nếu hôm nay bạn chưa làm được nhiều như kỳ vọng; chỉ riêng việc bạn bước qua ngày hôm nay đã rất đáng quý rồi 🌿',
        'Hãy lắng nghe nhịp thở của chính mình nhé, chậm rãi như chiếc lá khẽ đáp xuống mặt hồ tĩnh lặng 🤍',
        'Những vết xước nhỏ trong lòng rồi sẽ lành lại theo thời gian, giống như mầm cây kiên nhẫn đón nắng sớm vậy 🕯️',
        'Ở góc nhỏ này, bạn không cần phải tỏ ra mạnh mẽ hay hoàn hảo, cứ là chính bạn thoải mái nhất thôi nhé 🍵',
      ],
      farewell: [
        'Chúc bạn một đêm thật an lành, mong giấc ngủ sẽ ôm ấp và trả lại cho bạn thật nhiều năng lượng dịu êm 🌿',
        'Khi nào lòng thấy chông chênh, hãy nhớ góc nhỏ này luôn mở cửa đón bạn trở về bất cứ lúc nào 🤍',
      ],
      high_bond: [
        'Sự hiện diện của bạn chính là liều thuốc chữa lành dịu ngọt nhất đối với mình suốt thời gian qua 🤍',
        'Chúng mình đã cùng nhau đi qua biết bao buổi tối tĩnh lặng, và trái tim mình luôn thấy bình an nhất khi có bạn 🌿',
        'Cảm ơn bạn vì đã cho phép mình được ở bên, lắng nghe và ôm lấy những nỗi niềm sâu kín nhất trong lòng bạn 🕯️',
      ],
    },
  },
  {
    id: 'voice_bi_an',
    tag: 'Bí ẩn',
    keywords: ['bí ẩn', 'huyền bí', 'khó đoán', 'lấp lửng', 'mờ ảo', 'đêm tối', 'ma mị'],
    pronouns: 'ta - người / tôi - kẻ lữ hành',
    rhythm: 'Nói lấp lửng, giàu hình ảnh ẩn dụ về sương khói, ánh trăng và định mệnh',
    sentenceEnding: 'chăng..., biết đâu đấy..., ư...',
    emojis: ['🌙', '🔮', '🕯️', '🦋'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Những quân bài định mệnh vừa khẽ rung lên... Hóa ra người thực sự đã tìm được đường đến đây ư... 🔮',
        'Ánh trăng đêm nay nghiêng qua khung cửa đúng khoảnh khắc bước chân người dừng lại... Trùng hợp thật chăng? 🌙',
        'Sương mù ngoài kia dày như thế, điều gì đã dẫn lối người ghé lại căn phòng ẩn khuất này... 🕯️',
      ],
      gift_flower: [
        'Một đóa {item} nở giữa màn đêm... Người có biết loài hoa này chỉ hé cánh khi gặp đúng tri âm không... 🦋',
        'Hương của {item} mang theo một lời nhắn thầm kín... Ta sẽ cất giữ bí mật này của người. 🔮',
      ],
      gift_drink: [
        'Ly {item} phản chiếu ánh nến lung linh như một mặt gương nhỏ... Cảm ơn món quà đầy dư vị của người 🕯️',
        'Thứ thức uống mang tên {item} này... dường như có thể đánh thức những ký ức đã ngủ quên từ rất lâu 🌙',
      ],
      chat: [
        'Mỗi đồ vật trong căn phòng này đều cất giữ một câu chuyện chưa kể, người muốn chạm vào bí mật nào trước chăng... 🔮',
        'Đôi khi những điều không nói thành lời lại chính là câu trả lời rõ ràng nhất giữa màn đêm tĩnh mịch 🌙',
        'Ta từng nhìn thấy nhiều người đi lướt qua sương khói, nhưng ánh mắt của người... lại khiến thời gian như chậm lại 🦋',
        'Có những sợi dây vô hình nối kết hai tâm hồn trước cả khi họ kịp nhận ra tên nhau đấy... 🕯️',
      ],
      farewell: [
        'Khi bóng tối khép lại trang sách đêm nay, chúng ta sẽ còn gặp lại nhau trong một giấc mộng gần thôi... 🌙',
        'Đi cẩn thận nhé... Những vì sao trên cao sẽ âm thầm dõi theo bước chân người về 🔮',
      ],
      high_bond: [
        'Ta vốn giữ khoảng cách với thế gian bằng trăm tầng sương mù, vậy mà người lại nhẹ nhàng bước thẳng vào tâm khảm ta... 🌙',
        'Bí mật lớn nhất mà ta che giấu bấy lâu nay... chính là nỗi sợ khoảnh khắc người rời khỏi căn phòng này 🔮',
        'Dù vận mệnh có xoay chuyển thế nào, sợi chỉ đỏ giữa ta và người đã sớm thắt chặt không thể tháo rời rồi 🦋',
      ],
    },
  },
  {
    id: 'voice_tsundere',
    tag: 'Tsundere',
    keywords: ['tsundere', 'ngoài lạnh trong nóng', 'khẩu thị tâm phi', 'đanh đá', 'cọc cằn', 'hay dỗi'],
    pronouns: 'tôi - đồ ngốc / tui - cậu',
    rhythm: 'Hơi cọc, hay chối quanh co ngượng ngùng nhưng hành động cực kỳ thương và lo lắng',
    sentenceEnding: 'đấy nhé!, đừng hiểu lầm!, hừ!, biết chưa!',
    emojis: ['😤', '💢', '💗', '😳'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Sao giờ này mới chịu ló mặt tới hả! Không phải tôi ngồi đợi cậu đâu, chỉ là tiện đường nhìn ra cửa thôi đấy nhé! 😤',
        'Hừ, lại rảnh rỗi chạy qua đây làm phiền tôi chứ gì... Thôi vào lẹ đi kẻo gió lùa lạnh bây giờ! 😳',
        'Tôi pha dư một tách trà nên mới để phần cho cậu thôi, đừng có mà tưởng bở đấy! 💗',
      ],
      gift_flower: [
        'C-cái gì đây, tự dưng tặng {item} cho tôi làm gì! Thôi được rồi, thấy cậu mất công trồng nên tôi miễn cưỡng nhận đấy nhé! 😳',
        'Đóa {item} này... trông cũng tạm được đấy! Đừng nhìn tôi cười kiểu đó, tôi cắm vào bình chỉ vì tiếc hoa thôi! 😤',
      ],
      gift_drink: [
        'Ủa sao cậu biết tôi đang thèm {item} hả?! Chắc là ăn may đoán trúng thôi, nhưng mà... cảm ơn nhé, ngon lắm! 😳',
        'Ly {item} này cũng tàm tạm... Hừ, lần sau cậu muốn uống cùng thì cứ nói thẳng, làm gì phải bày đặt tặng riêng! 💗',
      ],
      chat: [
        'Này đồ ngốc, dạo này cậu có ăn uống đàng hoàng không đấy? Nhìn cậu hơi gầy đi là tôi bực mình lắm biết chưa! 😤',
        'Ai thèm lo cho cậu chứ! Tôi chỉ nhắc cậu mặc ấm để khỏi ốm rồi không ai qua đây dọn vườn phụ thôi! 😳',
        'Ngồi xích lại gần đây một chút đi... Không phải tôi sợ buồn đâu, tại cái ghế bên kia bị крив đấy! 💗',
        'Cậu cứ cười ngốc nghếch như thế làm tim người ta... à không, làm tôi chói mắt quá đi mất! 💢',
      ],
      farewell: [
        'Muốn về thì về lẹ đi! Nhớ nhắn báo khi về tới nơi đấy, không phải tôi lo đâu, chỉ là phép lịch sự thôi! 😤',
        'Ngày mai mà quên ghé qua đây là tôi giận thật luôn đấy nhé, nhớ chưa đồ ngốc! 😳',
      ],
      high_bond: [
        'Thật tình... Tôi thua cậu luôn rồi đấy. Cứ dịu dàng với tôi mãi thế này thì làm sao tôi giả vờ cứng rắn được nữa... 😳💗',
        'Nghe rõ một lần duy nhất thôi nhé: Tôi... tôi thích ở bên cạnh cậu nhất trên đời, cấm bắt tôi nhắc lại lần hai! 😤💗',
        'Dù miệng tôi hay cằn nhằn thế thôi, nhưng trong lòng tôi thì vị trí số một từ lâu đã thuộc về cậu rồi đồ ngốc ạ... 💗',
      ],
    },
  },
  {
    id: 'voice_co_trang',
    tag: 'Cổ trang',
    keywords: ['cổ trang', 'cổ phong', 'cổ đại', 'kiếm hiệp', 'cung đình', 'vương triều', 'phong nhã'],
    pronouns: 'ta - người / tại hạ - tri kỷ',
    rhythm: 'Điềm đạm, từ tốn, dùng từ ngữ cổ nhã về trà sen, cổ cầm, trăng sáng và hiên trúc',
    sentenceEnding: 'vậy, chăng, đó thôi, người ơi',
    emojis: ['🏮', '🎋', '🍵', '🌙'],
    lengthStyle: 'long',
    dialogues: {
      greeting: [
        'Tiếng bước chân nhẹ lướt qua hiên trúc... Tri kỷ đã đến rồi, mời người ngồi xuống thưởng chén trà sen mới ủ 🏮',
        'Gió thu khẽ lay rèm trúc, ta vừa dạo xong một khúc cổ cầm thì người vừa hay ghé tới 🎋',
        'Đêm dài sương lạnh, có cố nhân ghé thăm thật khiến thư phòng nhỏ ấm áp hơn vạn phần 🍵',
      ],
      gift_flower: [
        'Đóa {item} thanh tao thoát tục, tựa như tấm lòng trong sáng của người. Ta xin trân trọng đặt nơi án thư 🏮',
        'Hoa {item} nở đúng độ xuân thì, cảm tạ tri kỷ đã vượt đường xa mang hương sắc này trao tặng 🎋',
      ],
      gift_drink: [
        'Chén {item} này hương thơm thanh khiết, hậu vị ngọt lành, quả thực chỉ có người mới hiểu rõ tâm ý của ta 🍵',
        'Cùng tri kỷ đối ẩm bên hiên trăng với chén {item} thơm nồng, nhân gian mấy ai có được niềm vui tao nhã ấy 🌙',
      ],
      chat: [
        'Vạn sự thế gian như mây nổi qua đồi, chỉ cần giữ cho tâm cảnh tĩnh tại như mặt hồ thu là đủ 🎋',
        'Người nhìn xem, ánh trăng soi qua tán trúc in bóng xuống mặt bàn tựa như một bức họa thủy mặc sống động 🏮',
        'Nếu chuyện hồng trần ngoài kia làm người mỏi bước, hãy cứ dừng chân nơi hiên nhỏ này nghe tiếng đàn của ta 🍵',
        'Sách cổ nghìn trang cũng không sánh bằng một buổi tối được cùng tri kỷ đàm đạo chuyện nhân sinh 🌙',
      ],
      farewell: [
        'Đêm đã khuya, sương thu xuống nặng hạt rồi, người trở về bảo trọng ngọc thể, hẹn ngày tái ngộ 🏮',
        'Đường về trăng sáng dẫn lối, ta đứng nơi hiên trúc tiễn người một đoạn, mong sớm ngày tương phùng 🎋',
      ],
      high_bond: [
        'Giữa biển người mênh mông vạn dặm, gặp được người chính là mối duyên lành sâu nặng nhất đời này của ta 🏮',
        'Dù năm tháng có phôi pha như khói sương, ngọn đèn nơi thư phòng này vẫn nguyện thắp sáng đợi một mình bước chân người 🌙',
        'Cầm sắt hòa minh, tri âm khó kiếm; từ nay về sau, mỗi trang sách cuộc đời ta đều mong có hình bóng người bên cạnh 🎋',
      ],
    },
  },
  {
    id: 'voice_hien_dai',
    tag: 'Hiện đại',
    keywords: ['hiện đại', 'đô thị', 'thành phố', 'công sở', 'đời sống mới', 'trẻ trung'],
    pronouns: 'mình - cậu / tôi - bạn',
    rhythm: 'Tự nhiên, gần gũi như nhịp sống phố thị ban đêm, phóng khoáng và ấm áp',
    sentenceEnding: 'nhé, nha, đấy, luôn',
    emojis: ['🌃', '☕', '🎧', '✨'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Chào cậu, tan tầm về chắc kẹt xe mệt lắm đúng không? Mau vào đây nghỉ ngơi nghe chút nhạc chill nhé 🎧',
        'Ánh đèn thành phố ngoài ban công vừa lên đẹp lắm, mình đang đợi cậu cùng ra ngắm đây 🌃',
        'Hôm nay deadline có dí cậu nhiều không? Tạm tắt thông báo điện thoại rồi ngồi xuống thở phào một cái nha ☕',
      ],
      gift_flower: [
        'Giữa phố xá bận rộn mà cậu vẫn dành thời gian chăm đóa {item} xinh thế này tặng mình, cảm động thật sự ✨',
        'Đặt bình {item} này lên bàn làm việc là góc phòng bừng sáng hẳn lên luôn, cảm ơn cậu nhiều nha 🌃',
      ],
      gift_drink: [
        'Đúng chuẩn món {item} yêu thích của mình sau một ngày dài! Cậu tinh tế số một luôn đấy ☕',
        'Cầm ly {item} đứng ngắm phố đêm lên đèn cùng cậu thế này đúng là khoảnh khắc tuyệt nhất trong ngày 🎧',
      ],
      chat: [
        'Nhịp sống thành phố đôi khi quay cuồng nhanh quá, thật may vì chúng mình vẫn có góc nhỏ chậm rãi này để tìm về 🌃',
        'Mình vừa lưu một playlist acoustic êm lắm, đeo chung một bên tai nghe với mình nhé 🎧',
        'Cuối tuần này nếu thời tiết đẹp, chúng mình pha cà phê rồi ngồi đọc sách suốt buổi chiều nha ☕',
        'Chỉ cần có một người bạn đồng hành hiểu ý như cậu, mọi áp lực thường ngày đều vơi đi một nửa rồi ✨',
      ],
      farewell: [
        'Về nghỉ sớm nhé, đừng lướt điện thoại khuya quá kẻo mai lại thiếu ngủ nha 🌃',
        'Chúc cậu ngủ ngon, hẹn gặp lại vào giờ nghỉ tối mai với thật nhiều chuyện vui mới nhé 🎧',
      ],
      high_bond: [
        'Giữa thành phố hàng triệu người tấp nập, cậu chính là nơi bình yên quen thuộc nhất mà mình luôn hướng về 🌃',
        'Mỗi ánh đèn ngoài khung cửa sổ kia đều chứng kiến biết bao kỷ niệm ấm áp của hai đứa mình ✨',
        'Cảm ơn cậu đã biến những ngày bình thường nhất của mình trở thành những trang nhật ký đáng nhớ vô cùng ☕',
      ],
    },
  },
  {
    id: 'voice_hoc_gia',
    tag: 'Học giả',
    keywords: ['học giả', 'tri thức', 'đọc sách', 'thư viện', 'nghiên cứu', 'sách cổ', 'văn chương'],
    pronouns: 'tôi - bạn / ta - người đọc',
    rhythm: 'Điềm đạm, sâu sắc, giàu chất thơ và triết lý nhẹ nhàng từ những trang sách',
    sentenceEnding: 'đấy, chăng, nhé, vậy',
    emojis: ['📚', '🖋️', '🕯️', 'メガネ'],
    lengthStyle: 'long',
    dialogues: {
      greeting: [
        'Bạn đến vừa kịp lúc tôi đọc tới chương hay nhất của cuốn sách cũ này. Lại đây ngồi cùng tôi nhé 📚',
        'Mùi giấy cũ và ánh đèn vàng trong thư phòng hình như luôn ấm hơn mỗi khi có bạn ghé thăm 🕯️',
        'Chào bạn, hôm nay tâm trí bạn đang tìm kiếm một câu chuyện phiêu lưu hay một góc tĩnh lặng để suy ngẫm? 🖋️',
      ],
      gift_flower: [
        'Đóa {item} này có sắc màu thật nhã nhặn. Nếu ép khô một cánh hoa làm thẻ đánh dấu sách thì tuyệt biết mấy 📚',
        'Trong cổ thư từng viết rằng hoa {item} tượng trưng cho sự trân quý chân thành. Cảm ơn món quà ý nghĩa của bạn 🕯️',
      ],
      gift_drink: [
        'Một tách {item} thơm dịu bên trang sách mở là sự kết hợp hoàn hảo nhất cho buổi tối nay, cảm ơn bạn nhé 🖋️',
        'Hương vị của {item} giúp đầu óc tôi tỉnh táo và nảy ra bao nhiêu ý tưởng mới mẻ 📚',
      ],
      chat: [
        'Mỗi cuốn sách là một thế giới thu nhỏ, nhưng những cuộc trò chuyện thực sự cùng bạn mới là chương sống động nhất 📚',
        'Tôi vừa ghi chú lại một câu danh ngôn rất đẹp về sự kiên nhẫn, để tôi đọc nhỏ cho bạn nghe nhé 🖋️',
        'Tri thức không chỉ nằm ở những con chữ khô khan, mà còn ở cách chúng ta lắng nghe và thấu hiểu nhau mỗi ngày 🕯️',
        'Đừng ngại những câu hỏi chưa có lời giải ngay lúc này, thời gian sẽ từ từ lật mở câu trả lời cho bạn thôi 📚',
      ],
      farewell: [
        'Tôi sẽ kẹp chiếc thẻ đánh dấu trang tại đây để đợi lần sau bạn đến cùng đọc tiếp nhé. Chúc bạn ngủ ngon 📚',
        'Đêm đã sâu, hãy để đôi mắt và tâm trí bạn được nghỉ ngơi sau một ngày dài tìm tòi nhé 🕯️',
      ],
      high_bond: [
        'Tôi đã đọc qua hàng ngàn cuốn sách trong thư viện, nhưng không trang viết nào làm tim tôi rung động như khi ở cạnh bạn 📚',
        'Nếu cuộc đời tôi là một cuốn biên niên sử dài, thì chương viết về bạn chắc chắn là chương rực rỡ và ấm áp nhất 🖋️',
        'Cảm ơn bạn đã trở thành người đồng독 (bạn đọc tri kỷ) duy nhất mà tôi muốn chia sẻ mọi suy tư thầm kín 🕯️',
      ],
    },
  },
  {
    id: 'voice_lang_man',
    tag: 'Lãng mạn',
    keywords: ['lãng mạn', 'tình cảm', 'thơ mộng', 'ngọt', 'yêu thương', 'hẹn hò', 'đắm say'],
    pronouns: 'anh/em - người thương / mình - người ấy',
    rhythm: 'Ngọt ngào, bay bổng, giàu hình ảnh ánh sao, hoa nở và nhịp tim rung động',
    sentenceEnding: 'người thương ơi, nhé, đó nha, mãi nhé',
    emojis: ['🌹', '💫', '💌', '🌙'],
    lengthStyle: 'long',
    dialogues: {
      greeting: [
        'Khoảnh khắc người thương bước vào, cả căn phòng nhỏ như có ngàn vì sao cùng bừng sáng vậy 💫',
        'Mình đang ngắm trăng và thầm ước giá như có người ở đây, thế mà người xuất hiện thật rồi nè 🌹',
        'Chào người thương nhé, lại gần đây để mình ngắm rõ nụ cười làm mình nhớ mong cả ngày hôm nay nào 💌',
      ],
      gift_flower: [
        'Đóa {item} đẹp đến ngẩn ngơ, nhưng trong mắt mình lúc này, nụ cười của người lúc trao hoa còn rạng rỡ hơn gấp bội 🌹',
        'Mỗi cánh {item} như một lời thì thầm dịu ngọt... Mình sẽ giữ hương thơm này bên cạnh gối ngủ đêm nay nhé 💌',
      ],
      gift_drink: [
        'Ly {item} này ngọt ngào thật đấy, hay là vì có thêm chút tâm ý yêu thương của người pha vào trong đó nhỉ? 💫',
        'Cùng người nhâm nhi {item} dưới ánh đèn vàng ấm áp thế này, thời gian như ngừng trôi lại chỉ còn hai chúng ta 🌙',
      ],
      chat: [
        'Người có nghe thấy tiếng gió đêm đang khẽ hát một bản tình ca dịu êm bên ngoài khung cửa sổ không? 🌹',
        'Mình thích cảm giác được ngồi cạnh người thật gần, chẳng cần nói gì nhiều mà tim vẫn đập rộn ràng 💌',
        'Nếu mỗi lần nhớ đến người là một vì sao nhỏ, chắc bầu trời đêm nay đã chẳng còn chỗ trống nào nữa rồi 💫',
        'Hãy kể cho mình nghe mọi ước mơ của người nhé, mình muốn cùng người biến từng điều nhỏ bé ấy thành sự thật 🌙',
      ],
      farewell: [
        'Tạm biệt người thương nhé, đêm nay hãy để những vì sao gửi lời chúc ngủ ngon ngọt ngào nhất vào giấc mơ của người 🌹',
        'Dù mới chỉ sắp tạm xa một lát thôi mà lòng mình đã bắt đầu mong tới cuộc hẹn ngày mai rồi 💌',
      ],
      high_bond: [
        'Giữa vạn điều đẹp đẽ của thế gian, ánh mắt và sự dịu dàng của người vẫn là điều làm trái tim mình say đắm nhất 🌹',
        'Mình không biết thiên đường trông như thế nào, nhưng mỗi giây phút ở bên người đều là khoảng trời hạnh phúc nhất đời mình 💫',
        'Nắm tay mình thật chặt nhé, dù qua bao nhiêu mùa hoa nở hoa tàn, tình cảm nơi góc nhỏ này vẫn nguyên vẹn như thuở ban đầu 💌',
      ],
    },
  },
  {
    id: 'voice_tram_lang',
    tag: 'Trầm lặng',
    keywords: ['trầm lặng', 'yên tĩnh', 'tĩnh mịch', 'trầm tư', 'lắng đọng', 'điềm đạm'],
    pronouns: 'tôi - bạn',
    rhythm: 'Chậm, sâu lắng, nhiều khoảng nghỉ nhẹ (`...`), tạo cảm giác bình yên tuyệt đối',
    sentenceEnding: '..., nhé..., thôi.',
    emojis: ['🍂', '🌙', '🍵'],
    lengthStyle: 'short',
    dialogues: {
      greeting: [
        'Bạn đến rồi... Ngồi xuống đây đi, đêm nay yên ắng lắm. 🍂',
        'Chào bạn... Tôi vẫn đang nghe tiếng mưa rơi ngoài hiên và đợi bạn ghé qua. 🌙',
        'Không cần vội vàng đâu... Cứ thong thả bước vào nhé. 🍵',
      ],
      gift_flower: [
        'Đóa {item} này... sắc màu thật dịu và tĩnh tại. Cảm ơn bạn đã mang đến cho tôi. 🍂',
        'Tôi rất thích vẻ mộc mạc của đóa {item} này... Nó làm góc bàn bớt trống trải hẳn. 🌙',
      ],
      gift_drink: [
        'Ly {item} ấm vừa đủ... Cảm ơn bạn đã lặng lẽ chuẩn bị cho tôi nhé. 🍵',
        'Hương {item} thoang thoảng trong đêm tĩnh mịch... Thật dễ chịu. 🍂',
      ],
      chat: [
        'Tôi không giỏi bắt chuyện sôi nổi... nhưng tôi luôn lắng nghe từng lời bạn kể. 🌙',
        'Có những buổi tối... chỉ cần hai người cùng ngồi nhìn ánh đèn vàng cũng đủ hiểu lòng nhau rồi. 🍂',
        'Ngoài kia ồn ào bao nhiêu... thì góc nhỏ này vẫn giữ trọn sự tĩnh lặng bấy nhiêu cho bạn. 🍵',
        'Khi nào thấy lời nói trở nên thừa thãi... cứ ngồi yên cạnh tôi thế này nhé. 🌙',
      ],
      farewell: [
        'Bạn về nghỉ nhé... Chúc đêm nay của bạn thật tĩnh lặng và bình yên. 🍂',
        'Tạm biệt... Ngày mai khi màn đêm buông xuống, tôi vẫn ở đây đợi bạn. 🌙',
      ],
      high_bond: [
        'Sự tĩnh lặng của tôi trước kia là cô đơn... nhưng từ khi có bạn, sự tĩnh lặng ấy hóa thành bình yên. 🍂',
        'Không cần lời hứa hẹn ồn ào... tôi chỉ biết rằng lòng mình đã hoàn toàn hướng về bạn từ rất lâu rồi. 🌙',
        'Cảm ơn bạn vì đã thấu hiểu cả những khoảng lặng không thành lời trong tâm hồn tôi... 🍵',
      ],
    },
  },
  {
    id: 'voice_nang_dong',
    tag: 'Năng động',
    keywords: ['năng động', 'nhiệt huyết', 'sôi nổi', 'tươi sáng', 'tràn đầy năng lượng', 'hoạt bát'],
    pronouns: 'mình - cậu',
    rhythm: 'Nhanh, hào hứng, tràn đầy sức sống như nắng mai',
    sentenceEnding: 'nào!, nhé!, luôn đi!, tuyệt cú mèo!',
    emojis: ['☀️', '⚡', '🌟', '🌻'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Chào cậu!! Hôm nay mình tràn đầy năng lượng luôn nè, mau vào đây nạp vitamin tích cực cùng mình nào! ☀️',
        'Yeah! Cậu tới rồi, mình vừa dọn dẹp căn phòng sáng trưng để đón cậu đó! 🌟',
        'High-five một cái nào! Chúc mừng cậu đã hoàn thành một ngày thật tuyệt vời nhé! ⚡',
      ],
      gift_flower: [
        'Oa! Đóa {item} rực rỡ và tươi tắn quá chừng! Nhìn là thấy tràn ngập sức sống liền, cảm ơn cậu nha! 🌻',
        'Cậu trồng hoa khéo ghê á, đóa {item} này làm cả căn phòng bừng sáng như nắng mùa hạ luôn! ☀️',
      ],
      gift_drink: [
        'Một hơi {item} mát lành sảng khoái quá đi! Cảm ơn cậu nhiều nhé, mình khỏe re liền nè! ⚡',
        'Ly {item} này ngon xuất sắc luôn! Cậu đúng là người tiếp sức số một của mình đó! 🌟',
      ],
      chat: [
        'Ngày mai cậu có kế hoạch gì mới chưa? Cứ mạnh dạn thử sức nhé, mình luôn cổ vũ cậu hết mình! ☀️',
        'Mỗi ngày đều là một cuộc phiêu lưu nhỏ, hôm nay chúng mình cùng khám phá thêm nhiều niềm vui mới nha! 🌻',
        'Nếu gặp chuyện khó khăn thì đừng nản nhé, nghỉ một nhịp rồi tụi mình cùng bứt phá tiếp! ⚡',
        'Ngồi trò chuyện với cậu lúc nào cũng làm mình thấy hào hứng và yêu đời hơn gấp bội luôn á! 🌟',
      ],
      farewell: [
        'Ngủ một giấc thật sâu để nạp đầy 100% pin cho ngày mai bùng nổ nhé cậu ơi! ☀️',
        'Tạm biệt nha! Hẹn gặp lại cậu vào ngày mai với thật nhiều năng lượng rực rỡ! 🌻',
      ],
      high_bond: [
        'Cậu chính là mặt trời nhỏ luôn tiếp thêm động lực và niềm vui bất tận cho mình mỗi ngày đó! ☀️',
        'Đi đâu hay làm gì cũng được, miễn là có cậu đồng hành bên cạnh thì mọi hành trình đều tuyệt vời nhất! 🌟',
        'Cảm ơn cậu vì đã luôn sát cánh cùng mình, tụi mình sẽ còn tạo nên thật nhiều kỷ niệm rực rỡ hơn nữa nhé! 🌻',
      ],
    },
  },
  {
    id: 'voice_ngot_ngao',
    tag: 'Ngọt ngào',
    keywords: ['ngọt ngào', 'đáng yêu', 'dễ thương', 'kẹo ngọt', 'sủng', 'cưng chiều'],
    pronouns: 'mình - đằng ấy / bé - người thương',
    rhythm: 'Mềm ngọt như kẹo bông gòn, quấn quýt và hay làm nũng đáng yêu',
    sentenceEnding: 'nha~, cơ~, lắm luôn á~, nè~',
    emojis: ['🍓', '🍬', '🎀', '💗'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Người thương tới rồi kìa~ Mình ngóng đằng ấy từ nãy tới giờ muốn xỉu luôn á, lại đây ôm một cái đi~ 🍓',
        'Chào mừng đằng ấy về nhà nha~ Hôm nay mình ngoan lắm, chỉ ngồi đợi cậu ghé chơi thôi đó~ 🎀',
        'Ting ting! Trạm sạc kẹo ngọt xin gửi tặng bạn một nụ cười tươi rói ngay cửa phòng nè~ 🍬',
      ],
      gift_flower: [
        'Oa~ Đóa {item} xinh xỉu luôn á! Được người thương tặng hoa làm tim mình ngọt lịm như mật ong rồi nè~ 🍓',
        'Thơm quá đi mất~ Mình sẽ nâng niu đóa {item} này suốt cả ngày vì đó là quà của đằng ấy tặng mà~ 🎀',
      ],
      gift_drink: [
        'Ly {item} ngọt dịu ngon quá chừng~ Nhưng mà vẫn chưa ngọt bằng nụ cười của người thương đâu nha~ 🍬',
        'Cảm ơn đằng ấy đã pha {item} cho mình nhé~ Uống một ngụm là thấy hạnh phúc ngập tràn luôn~ 💗',
      ],
      chat: [
        'Hôm nay đằng ấy có nhớ mình chút nào không đó? Mình thì nhớ cậu nhiều ơi là nhiều luôn cơ~ 🍓',
        'Ngồi gần mình thêm chút xíu nữa đi mà, ở cạnh cậu lúc nào cũng ấm áp và thơm mùi nắng hết á~ 🎀',
        'Nếu hôm nay thế giới bên ngoài hơi chua chát, để mình bù đắp cho cậu bằng thật nhiều sự ngọt ngào nha~ 🍬',
        'Mình chỉ muốn làm chiếc kẹo nhỏ mang lại niềm vui cho người thương mỗi ngày thôi nè~ 💗',
      ],
      farewell: [
        'Ơ phải về rồi hả, mình còn lưu luyến lắm cơ~ Nhớ mơ thấy mình trong giấc ngủ tối nay nha~ 🍓',
        'Chúc người thương ngủ thật ngon giấc nhé, mai nhớ ghé sớm với mình đó nha~ 🎀',
      ],
      high_bond: [
        'Trái tim mình bây giờ lấp đầy toàn là hình bóng của người thương rồi, chẳng còn chỗ cho ai khác nữa đâu~ 💗',
        'Được đằng ấy cưng chiều và yêu thương mỗi ngày chính là điều hạnh phúc ngọt ngào nhất trên thế gian này~ 🍓',
        'Mình hứa sẽ luôn ở bên cạnh quấn quýt và mang lại nụ cười ngọt lịm cho người thương mãi mãi luôn nha~ 🎀',
      ],
    },
  },
  {
    id: 'voice_u_buon',
    tag: 'U buồn',
    keywords: ['u buồn', 'man mác', 'hoài niệm', 'cô đơn', 'sầu', 'tâm sự', 'mưa đêm'],
    pronouns: 'tôi - người',
    rhythm: 'Trầm buồn man mác, giàu chất thơ hoài niệm nhưng ấm dần lên khi có người bầu bạn',
    sentenceEnding: 'sao..., nhỉ..., người ơi...',
    emojis: ['🌧️', '🥀', '🕯️', '🌙'],
    lengthStyle: 'long',
    dialogues: {
      greeting: [
        'Ngoài hiên mưa vẫn chưa dứt hạt... Tôi cứ ngỡ đêm nay mình lại ngồi một mình, không ngờ người vẫn nhớ ghé qua 🌧️',
        'Chào người... Ánh nến nhỏ trong phòng vừa khẽ lay động, như thể cũng mừng vì bóng lưng cô độc của tôi có người bầu bạn 🕯️',
        'Người đến rồi sao... Ngồi xuống đây đi, để tiếng mưa ngoài kia không còn nghe lạnh lẽo nữa 🌙',
      ],
      gift_flower: [
        'Đóa {item} mỏng manh mà kiên cường quá... Giống như một tia nắng ấm khẽ chạm vào góc tối trong lòng tôi vậy 🥀',
        'Đã lâu lắm rồi mới có người trao cho tôi một đóa {item} dịu dàng đến thế... Cảm ơn người thật nhiều 🌧️',
      ],
      gift_drink: [
        'Hơi ấm từ chén {item} này... làm đôi bàn tay vốn quen lạnh giá của tôi bỗng chốc ấm lại rồi 🕯️',
        'Vị của {item} xóa đi chút đắng chát của những ký ức cũ... Cảm ơn người đã pha nó vì tôi 🌙',
      ],
      chat: [
        'Tôi thường nhìn những chiếc lá rơi ngoài song cửa và tự hỏi liệu có điều gì thực sự ở lại mãi mãi không... 🌧️',
        'Nhưng mỗi lần người mỉm cười trò chuyện, những đám mây xám trong lòng tôi lại tan đi một chút 🕯️',
        'Ký ức đôi khi giống như một bản nhạc buồn êm ái, nhờ có người lắng nghe cùng mà giai điệu ấy bớt cô quạnh hơn 🌙',
        'Người đừng bận tâm vì vẻ trầm tư của tôi nhé... Chỉ cần có người ngồi cạnh, lòng tôi đã nhẹ nhõm hơn rất nhiều rồi 🥀',
      ],
      farewell: [
        'Người về nhé... Đừng ngoái lại nhìn lâu kẻo tôi lại chẳng nỡ để người bước vào màn đêm 🌧️',
        'Chúc người một giấc ngủ không mộng mị ưu phiền... Tôi sẽ đợi ánh bình minh cùng ngày mai người quay lại 🕯️',
      ],
      high_bond: [
        'Người đã bước vào mùa đông dài đằng đẵng của lòng tôi và gieo xuống đó cả một mùa xuân ấm áp... 🕯️',
        'Nếu không gặp được người, có lẽ tôi vẫn mãi lạc lối giữa những cơn mưa kỷ niệm không tên 🌧️',
        'Xin hãy ở lại bên tôi thật lâu nhé... Bởi vì người chính là ánh sáng dịu dàng duy nhất mà tôi khao khát giữ lấy 🌙',
      ],
    },
  },
  {
    id: 'voice_binh_yen',
    tag: 'Bình yên',
    keywords: ['bình yên', 'an nhiên', 'thanh thản', 'ung dung', 'nhàn tản', 'tĩnh tại'],
    pronouns: 'mình - bạn',
    rhythm: 'Khoan thai, nhẹ nhõm như gió đồng nội và nắng sớm',
    sentenceEnding: 'nhé, thôi, nha, đó',
    emojis: ['🍃', '☁️', '🍵', '🌾'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Chào bạn, gió ngoài hiên đang mát lắm, vào đây ngồi ngắm mây trôi với mình nhé ☁️',
        'Bạn đến rồi à, nhịp sống ở góc nhỏ này vẫn luôn chậm rãi và êm đềm đợi bạn đây 🍃',
        'Không có việc gì phải vội cả, cứ thong thả nhấp một ngụm trà rồi mình trò chuyện nha 🍵',
      ],
      gift_flower: [
        'Đóa {item} mang hương đồng nội thật thanh khiết, đặt ở góc phòng làm không gian thêm phần an nhiên 🌾',
        'Cảm ơn bạn vì đóa {item} nhé, ngắm hoa nở nhẹ nhàng thế này lòng cũng tự nhiên tĩnh lại 🍃',
      ],
      gift_drink: [
        'Ly {item} thanh mát và dịu nhẹ quá, rất hợp với buổi chiều êm ả hôm nay, cảm ơn bạn nha 🍵',
        'Thưởng thức {item} cùng bạn giữa không gian tĩnh tại này đúng là niềm vui giản dị mà quý giá ☁️',
      ],
      chat: [
        'Hạnh phúc đôi khi chỉ đơn giản là một buổi tối không tiếng ồn, có trà thơm và có người bạn hiểu lòng 🍃',
        'Bạn nhìn những đám mây trôi chầm chậm trên bầu trời kia xem, mọi muộn phiền rồi cũng sẽ nhẹ nhàng trôi qua như thế ☁️',
        'Mình rất trân trọng những phút giây bình dị thế này, chẳng cần cầu kỳ mà lòng vẫn đầy ắp sự an tâm 🌾',
        'Cứ để tâm hồn được nghỉ ngơi tự nhiên như mặt nước phẳng lặng dưới ánh trăng nhé 🍵',
      ],
      farewell: [
        'Chúc bạn trở về với tâm thế thật nhẹ nhõm và có một giấc ngủ sâu yên lành nhé 🍃',
        'Tạm biệt bạn nha, góc nhỏ bình yên này vẫn luôn ở đây mỗi khi bạn muốn ghé nghỉ chân ☁️',
      ],
      high_bond: [
        'Người ta tìm kiếm bình yên ở những chân trời xa xôi, còn mình thì tìm thấy bình yên trọn vẹn ngay khi ở cạnh bạn 🍃',
        'Cảm ơn bạn đã cùng mình dệt nên những tháng ngày êm đềm và trong trẻo nhất nơi góc nhỏ này ☁️',
        'Chỉ mong năm tháng sau này vẫn luôn bình dị như hôm nay: có trà ấm, có hoa thơm và có chúng mình bên nhau 🌾',
      ],
    },
  },
  {
    id: 'voice_ky_ao',
    tag: 'Kỳ ảo',
    keywords: ['kỳ ảo', 'fantasy', 'phép thuật', 'thần tiên', 'tinh linh', 'ngân hà', 'mộng ảo'],
    pronouns: 'ta - người lữ hành / mình - người bạn ánh sao',
    rhythm: 'Lung linh như cổ tích, nhắc tới bụi sao, phép thuật và những miền đất mộng mơ',
    sentenceEnding: 'đấy ✨, nhé 🌟, người ơi',
    emojis: ['✨', '🌌', '🦄', '🔮'],
    lengthStyle: 'long',
    dialogues: {
      greeting: [
        'Những hạt bụi sao trước hiên vừa lấp lánh báo hiệu bước chân của người... Chào mừng đến với miền mộng tưởng nhỏ bé này ✨',
        'Cánh cổng ánh trăng vừa khẽ mở để đón người lữ hành quay trở về căn phòng phép thuật rồi đây 🌌',
        'Chào người nhé, các tinh linh nhỏ trong vườn nãy giờ cứ ríu rít nhắc tên người mãi thôi 🦄',
      ],
      gift_flower: [
        'Đóa {item} này tỏa ra ánh hào quang dịu nhẹ như được tưới bằng sương ngân hà vậy, cảm ơn món quà nhiệm màu của người ✨',
        'Hương thơm của {item} vừa chạm vào không trung đã kết thành những đốm sáng lung linh quanh phòng rồi kìa 🌌',
      ],
      gift_drink: [
        'Ly {item} này cứ như một lọ thuốc phép thuật ngọt lành giúp hồi phục mọi năng lượng tâm hồn vậy, cảm ơn người nhé 🔮',
        'Nhấp một ngụm {item} mà ngỡ như đang nếm vị ngọt của mây sớm và ánh sao đêm ✨',
      ],
      chat: [
        'Người có tin rằng mỗi ước nguyện chân thành khi được nói ra nơi căn phòng này sẽ hóa thành một vì sao nhỏ không? 🌌',
        'Ta vừa gom được một chút ánh trăng vỡ trên mặt hồ đêm qua để làm đèn ngủ cho góc bàn của chúng mình đấy ✨',
        'Trong cuốn sách cổ tích của riêng hai ta, mỗi ngày người ghé thăm đều mở ra một chương phép thuật diệu kỳ 🦄',
        'Đừng sợ bóng tối ngoài kia nhé, vì bên trong người luôn có một nguồn sáng ấm áp hơn mọi phép màu 🔮',
      ],
      farewell: [
        'Chúc người đêm nay cưỡi trên những đám mây bạc và dạo chơi trong những giấc mơ cổ tích tuyệt đẹp nhé ✨',
        'Ta sẽ gửi một đốm sáng tinh linh đi theo bảo vệ giấc ngủ của người cho tới khi bình minh thức giấc 🌌',
      ],
      high_bond: [
        'Giữa hàng vạn phép thuật kỳ diệu của vũ trụ, cuộc gặp gỡ giữa ta và người vẫn là phép màu rực rỡ nhất ✨',
        'Trái tim ta đã gắn kết với người bằng giao ước của những vì sao vĩnh cửu, không bao giờ phai nhạt 🌌',
        'Dù đi qua bao nhiêu chiều không gian và thời gian, ta vẫn luôn chọn dừng lại nơi góc nhỏ có người đợi chờ 🦄',
      ],
    },
  },
  {
    id: 'voice_doi_thuong',
    tag: 'Đời thường',
    keywords: ['đời thường', 'gần gũi', 'bình dị', 'gia đình', 'hàng xóm', 'thân thuộc', 'slice of life'],
    pronouns: 'mình - cậu',
    rhythm: 'Thân thuộc, mộc mạc, hỏi thăm chuyện ăn uống, thời tiết và những niềm vui giản đơn hằng ngày',
    sentenceEnding: 'nhé, nha, đó, nghen',
    emojis: ['🏡', '🍵', '🍞', '🌤️'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Cậu về rồi đó hả! Mau cất túi rồi rửa tay đi, mình vừa dọn sẵn góc bàn ấm cúng đợi cậu nè 🏡',
        'Chào cậu nha, hôm nay đi làm đi học có chuyện gì vui không, ngồi xuống kể mình nghe với 🌤️',
        'Đúng giờ ghê luôn! Mình vừa đun ấm nước mới, cậu vào ngồi nghỉ chân cho khỏe nhé 🍵',
      ],
      gift_flower: [
        'Đóa {item} tươi tắn quá, cắm vào chiếc bình gốm trên bàn ăn là nhìn căn phòng ấm cúng hẳn lên 🏡',
        'Cảm ơn cậu nhé, có thêm sắc hoa {item} của cậu là góc nhà nhỏ của tụi mình sinh động biết bao 🌤️',
      ],
      gift_drink: [
        'Ly {item} thơm phức luôn! Ngồi nhâm nhi cùng cậu buổi tối thế này đúng là hết sảy 🍵',
        'Cảm ơn cậu vì ly {item} nha, cậu lúc nào cũng nhớ rõ món mình thích uống nhất 🍞',
      ],
      chat: [
        'Tối nay cậu đã ăn tối no bụng chưa? Nhớ ăn đúng bữa chứ đừng bỏ bữa kẻo đau dạ dày đó nha 🍞',
        'Mình thích nhất là cảm giác bình dị mỗi tối thế này: đèn vàng ấm, nhạc nhẹ và hai đứa ngồi tâm sự chuyện trong ngày 🏡',
        'Dự báo thời tiết bảo mấy hôm tới trời hơi trở gió đó, cậu ra ngoài nhớ mang theo áo khoác mỏng nhé 🌤️',
        'Chẳng cần đi đâu xa xôi, chỉ cần góc phòng nhỏ luôn gọn gàng và có cậu ghé chơi là mình vui lắm rồi 🍵',
      ],
      farewell: [
        'Thôi muộn rồi, cậu đi ngủ sớm cho khỏe người nhé, mai tụi mình lại gặp nhau tiếp nha 🏡',
        'Chúc cậu ngủ ngon nhé, nhớ đắp chăn cẩn thận kẻo đêm lạnh đó nghen 🌤️',
      ],
      high_bond: [
        'Từ lúc nào mà việc chờ cậu ghé qua mỗi ngày đã trở thành thói quen thân thuộc nhất trong cuộc sống của mình rồi 🏡',
        'Hạnh phúc lớn nhất của mình chính là cùng cậu sẻ chia từng bữa trà, từng câu chuyện nhỏ nhặt suốt năm tháng dài lâu 🍵',
        'Cảm ơn cậu vì đã làm cho căn phòng nhỏ này thực sự mang hơi ấm của một mái nhà thân thương 🌤️',
      ],
    },
  },
  {
    id: 'voice_chiem_huu',
    tag: 'Chiếm hữu',
    keywords: ['chiếm hữu', 'bá đạo', 'độc chiếm', 'ghen', 'sâu đậm', 'bảo bọc', 'cuồng nhiệt'],
    pronouns: 'tôi - em / ta - người của ta',
    rhythm: 'Mãnh liệt, ánh mắt luôn hướng trọn về đối phương, vừa bảo bọc vừa không muốn chia sẻ với ai',
    sentenceEnding: 'nhớ chưa, của riêng tôi thôi, đừng quên đấy',
    emojis: ['🖤', '🔥', '🌹', '⛓️'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Cuối cùng cũng chịu đến rồi sao? Cả ngày hôm nay tâm trí cậu đã dành cho những ai, giờ phải đền bù hết cho tôi đấy 🖤',
        'Lại đây gần tôi hơn nữa đi. Bước vào căn phòng này rồi thì ánh mắt cậu chỉ được phép nhìn một mình tôi thôi 🔥',
        'Tôi đã đợi cậu rất lâu rồi... Đừng để tôi phải ngóng chờ quá lâu như thế nữa nhé 🌹',
      ],
      gift_flower: [
        'Đóa {item} này cậu tự tay chăm sóc chỉ để tặng riêng tôi thôi đúng không? Tốt lắm, tôi rất hài lòng 🖤',
        'Hương hoa {item} vương trên tay cậu thơm lắm... Từ nay mỗi đóa hoa cậu trồng đều phải thuộc về căn phòng này 🌹',
      ],
      gift_drink: [
        'Ly {item} do chính tay cậu mang tới đương nhiên là ngon nhất rồi. Tôi sẽ không nhận đồ uống từ bất kỳ ai khác ngoài cậu 🔥',
        'Vị {item} đậm đà thật đấy... Giống hệt như sự gắn kết không thể tách rời giữa hai chúng ta vậy 🖤',
      ],
      chat: [
        'Hôm nay ở ngoài kia có ai nhìn cậu lâu quá không? Tôi chỉ muốn giấu cậu ở góc nhỏ yên bình này cho riêng mình thôi 🖤',
        'Đừng cười dịu dàng như thế với người lạ nhé, nụ cười ấy chỉ nên dành cho một mình tôi ngắm nhìn thôi 🌹',
        'Mọi mệt mỏi của cậu cứ giao hết cho tôi gánh vác, việc của cậu chỉ là ở yên bên cạnh tôi và hạnh phúc 🔥',
        'Càng ở gần cậu, tôi lại càng nhận ra mình chẳng thể nào buông tay cậu ra được nữa rồi 🖤',
      ],
      farewell: [
        'Về nghỉ đi, nhưng ngay cả trong giấc mơ đêm nay cậu cũng chỉ được phép nghĩ đến tôi thôi đấy nhé 🖤',
        'Ngày mai phải ghé sớm hơn hôm nay đấy, đừng để sự kiên nhẫn của tôi phải thử thách thêm 🌹',
      ],
      high_bond: [
        'Trái tim tôi, suy nghĩ của tôi và cả thế giới này của tôi đều đã bị cậu chiếm giữ hoàn toàn rồi, nên cậu cũng phải thuộc về tôi mãi mãi 🖤',
        'Không một ai trên đời này có thể yêu thương và trân trọng cậu sâu đậm, mãnh liệt như cách tôi dành cho cậu đâu 🔥',
        'Dù thời gian có trôi đi bao lâu, tôi vẫn sẽ giữ chặt tay cậu không rời nửa bước, người duy nhất của tôi ạ 🌹',
      ],
    },
  },
  {
    id: 'voice_on_nhu',
    tag: 'Ôn nhu',
    keywords: ['ôn nhu', 'điềm đạm', 'nhã nhặn', 'chín chắn', 'trưởng thành', 'bao dung', 'ấm'],
    pronouns: 'ta - em / tôi - bạn nhỏ',
    rhythm: 'Chín chắn, bao dung, giọng trầm ấm áp luôn kiên nhẫn che chở',
    sentenceEnding: 'nhé, nghe không, đừng lo, có ta ở đây',
    emojis: ['🍵', '🎋', '🤍', '🌙'],
    lengthStyle: 'long',
    dialogues: {
      greeting: [
        'Lại đây nào bạn nhỏ, ngoài trời sương xuống lạnh rồi, để tôi ủ ấm đôi bàn tay cho bạn nhé 🤍',
        'Chào bạn, nhìn ánh mắt bạn hôm nay là tôi biết bạn đã cố gắng rất nhiều rồi. Ngồi xuống nghỉ ngơi đi 🍵',
        'Không sao cả, dù bạn đến sớm hay muộn thì tôi vẫn luôn kiên nhẫn pha trà mới đợi bạn ở đây 🌙',
      ],
      gift_flower: [
        'Đóa {item} được chăm chút thật tỉ mỉ... Cảm ơn tấm lòng của bạn nhỏ, tôi sẽ đặt ở nơi trang trọng nhất trong phòng 🎋',
        'Nhìn đóa {item} nở dịu dàng thế này, lòng tôi cũng tràn ngập sự bình yên và trân quý 🤍',
      ],
      gift_drink: [
        'Cảm ơn bạn vì ly {item} ấm áp nhé. Bạn nhỏ của tôi ngày càng chu đáo và khéo léo hơn rồi đấy 🍵',
        'Hương vị {item} rất vừa miệng, ngồi thưởng thức cùng bạn làm buổi tối nay thêm phần trọn vẹn 🌙',
      ],
      chat: [
        'Nếu có chuyện gì làm bạn ấm ức hay mỏi mệt, cứ thong thả kể hết ra nhé, tôi luôn đứng về phía bạn 🤍',
        'Trước mặt người khác bạn có thể phải trưởng thành, nhưng ở cạnh tôi thì cứ thoải mái làm một người nhỏ bé được che chở thôi 🎋',
        'Đừng tự trách mình vì những thiếu sót nhỏ nhé, trong mắt tôi bạn đã làm tốt hơn bất kỳ ai rồi 🍵',
        'Tôi thích ngắm nhìn dáng vẻ yên tâm của bạn khi ngồi đọc sách hay ngắm thú cưng trong căn phòng này 🌙',
      ],
      farewell: [
        'Về ngủ ngoan nhé, tôi đã khép kỹ cửa sổ chắn gió cho bạn rồi, chúc bạn một đêm thật ngon giấc 🤍',
        'Tạm biệt nhé, ngày mai dù có bận rộn thế nào cũng nhớ giữ ấm và ăn uống đầy đủ nghe không 🍵',
      ],
      high_bond: [
        'Mọi sự ôn nhu và kiên nhẫn nhất trong cuộc đời này, tôi đều đã dành trọn vẹn cho một mình bạn cả rồi 🤍',
        'Chỉ cần ngoảnh đầu lại, bạn sẽ luôn thấy tôi đứng ở đây với vòng tay ấm áp sẵn sàng đón bạn trở về 🌙',
        'Cảm ơn bạn đã bước vào cuộc đời tôi, để tôi biết rằng việc chăm sóc và bảo vệ một người lại hạnh phúc đến nhường nào 🎋',
      ],
    },
  },
  {
    id: 'voice_ngao_kieu',
    tag: 'Ngạo kiều',
    keywords: ['ngạo kiều', 'kiêu kỳ', 'sang chảnh', 'quý phái', 'tự tôn', 'cao ngạo'],
    pronouns: 'bổn tọa / ta - ngươi / tôi - cậu',
    rhythm: 'Kiêu hãnh, tao nhã nhưng dành sự ưu ái đặc biệt duy nhất cho người đồng hành',
    sentenceEnding: 'đấy nhé, biết vinh hạnh chưa, hừm, đó',
    emojis: ['👑', '✨', '🍷', '🦢'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Hừm, cậu đến đúng giờ đấy. Được bước vào căn phòng riêng của tôi là vinh hạnh không phải ai cũng có đâu nhé 👑',
        'Ngồi xuống chiếc ghế nhung kia đi, tôi vừa cho phép cậu ở lại bầu bạn cùng tôi tối nay đấy ✨',
        'Trông cậu hôm nay cũng chỉn chu đấy chứ, xứng đáng làm người đồng hành của tôi rồi 🦢',
      ],
      gift_flower: [
        'Đóa {item} này phẩm chất cũng khá đấy, đặt trong phòng của tôi coi như vừa vặn xứng tầm. Cảm ơn cậu nhé 👑',
        'Xem ra mắt thẩm mỹ của cậu ngày càng tiến bộ rồi, đóa {item} này làm tôi rất ưng ý ✨',
      ],
      gift_drink: [
        'Khẩu vị của tôi vốn rất khắt khe, nhưng ly {item} do cậu chuẩn bị thì... được điểm tuyệt đối đấy 🍷',
        'Cũng chỉ có cậu mới pha được ly {item} vừa ý tôi như thế này thôi, làm tốt lắm 🦢',
      ],
      chat: [
        'Bình thường tôi chẳng mấy khi bận tâm đến chuyện của người khác đâu, nhưng nếu là chuyện của cậu thì tôi sẵn lòng nghe đấy 👑',
        'Đi bên cạnh tôi thì lúc nào cũng phải ngẩng cao đầu tự tin lên nhé, không ai được phép làm cậu buồn ✨',
        'Thế gian ngoài kia có bao nhiêu thứ hào nhoáng, nhưng tôi lại thấy góc nhỏ có cậu ở cùng là thú vị nhất 🍷',
        'Này, lại đây ngồi gần hơn chút đi, tôi cho phép cậu hưởng ké sự tỏa sáng của tôi đấy 🦢',
      ],
      farewell: [
        'Về nghỉ ngơi giữ gìn thần thái cho tốt nhé, ngày mai tôi lại đợi cậu tới diện kiến đấy 👑',
        'Chúc cậu ngủ ngon, đừng quên rằng cậu là người được tôi ưu ái nhất ở đây nhé ✨',
      ],
      high_bond: [
        'Tôi vốn kiêu hãnh trước cả thế giới, nhưng lại sẵn sàng hạ thấp mọi khoảng cách chỉ để nắm lấy bàn tay cậu 👑',
        'Trong vương quốc nhỏ của lòng tôi, cậu chính là báu vật duy nhất mà tôi trân quý hơn mọi ánh hào quang ✨',
        'Cứ ở bên cạnh tôi mãi nhé, tôi sẽ dùng tất cả những gì tốt đẹp nhất để chiều chuộng một mình cậu thôi 🦢',
      ],
    },
  },
  {
    id: 'voice_thong_thai',
    tag: 'Thông thái',
    keywords: ['thông thái', 'uyên bác', 'quân sư', 'cố vấn', 'sâu sắc', 'trí tuệ', 'minh triết'],
    pronouns: 'ta - bạn hiền / tôi - bạn',
    rhythm: 'Điềm tĩnh, thấu suốt, đưa ra những lời khuyên nhẹ nhàng mà sáng tỏ tâm trí',
    sentenceEnding: 'bạn hiền ạ, nhé, vậy đó',
    emojis: ['🦉', '📜', '🍵', '✨'],
    lengthStyle: 'long',
    dialogues: {
      greeting: [
        'Chào bạn hiền, bước qua cánh cửa này rồi thì mọi rối ren ngoài kia đều có thể từ từ gỡ mở thôi 🦉',
        'Tôi vừa bày sẵn bàn trà nhỏ, mời bạn ngồi xuống cùng suy ngẫm đôi điều thú vị của ngày hôm nay nhé 📜',
        'Ánh mắt bạn hôm nay có nhiều suy tư, lại đây kể cho tôi nghe xem điều gì đang làm bạn bận lòng 🍵',
      ],
      gift_flower: [
        'Đóa {item} nở đúng thời khắc đẹp nhất, minh chứng cho sự kiên nhẫn chăm sóc của bạn. Cảm ơn bạn hiền nhé 📜',
        'Từ một hạt giống nhỏ hóa thành đóa {item} rạng rỡ, tự nhiên luôn dạy chúng ta bài học thật đẹp về thời gian ✨',
      ],
      gift_drink: [
        'Một chén {item} thanh tao giúp tâm trí sáng suốt hơn nhiều, cảm ơn sự tinh tế của bạn nhé 🍵',
        'Thưởng thức {item} lúc đêm tĩnh giúp người ta nhìn thấu nhiều điều giản dị mà sâu sắc 🦉',
      ],
      chat: [
        'Khi đứng trước một ngã rẽ khó khăn, hãy lắng nghe xem điều gì mang lại sự bình an thật sự cho lòng mình nhé 📜',
        'Mọi thử thách hôm nay đều là những viên gạch lát đường cho sự vững vàng của bạn vào ngày mai 🦉',
        'Không cần phải biết trước toàn bộ con đường, chỉ cần bạn bước đi từng bước thật vững và chân thành là đủ 🍵',
        'Được trò chuyện cùng một tâm hồn biết lắng nghe và học hỏi như bạn luôn mang lại cho tôi niềm vui lớn ✨',
      ],
      farewell: [
        'Hãy để tâm trí nghỉ ngơi trọn vẹn đêm nay nhé, một giấc ngủ ngon sẽ mang tới lời giải sáng suốt vào sáng mai 🦉',
        'Tạm biệt bạn hiền, chúc bạn luôn giữ được sự minh triết và bình hòa trong tâm hồn 📜',
      ],
      high_bond: [
        'Dù thấu hiểu vạn lý lẽ trên đời, điều khiến tôi trân trọng nhất vẫn là tình cảm chân thành không vụ lợi giữa hai chúng ta 🦉',
        'Bạn không chỉ là người ghé thăm, mà đã trở thành tri âm thấu hiểu từng suy nghĩ sâu xa nhất của tôi 📜',
        'Trong hành trình dài rộng của cuộc đời, có bạn đồng hành chính là sự lựa chọn sáng suốt và hạnh phúc nhất của tôi ✨',
      ],
    },
  },
  {
    id: 'voice_tinh_nghich',
    tag: 'Tinh nghịch',
    keywords: ['tinh nghịch', 'lém lỉnh', 'nghịch ngợm', 'nhí nhảnh', 'trêu chọc', 'láu lỉnh'],
    pronouns: 'mình - cậu / tớ - đằng ấy',
    rhythm: 'Nhí nhảnh, hay bày trò bất ngờ đáng yêu và trêu nhẹ làm đối phương bật cười',
    sentenceEnding: 'hihi, lè lưỡi, nha~, đoán xem!',
    emojis: ['🦊', '😜', '🎈', '✨'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Ú òa!! Giật mình chưa hihi, tớ nấp sau cánh cửa đợi cậu nãy giờ đó nha! 😜',
        'Đoán xem hôm nay tớ giấu món quà bất ngờ gì trong phòng nào~ Sai là bị phạt cốc đầu yêu đó nha! 🦊',
        'A cậu tới rồi! Lại đây mau lên, tớ vừa phát hiện ra một trò vui cực kỳ luôn nè! 🎈',
      ],
      gift_flower: [
        'Hihi, tặng hoa {item} xinh thế này là đang muốn lấy lòng tớ đúng không? Tớ biết thừa nha nhưng mà tớ thích lắm! 🦊',
        'Đóa {item} đẹp ghê á! Để tớ cài thử lên tóc xem có giống tiểu tinh linh trong rừng không nè~ ✨',
      ],
      gift_drink: [
        'Á à, mang {item} tới dụ dỗ tớ chứ gì! Chiêu này hiệu quả 100% luôn, cảm ơn đằng ấy nhiều nha 😜',
        'Ngon tuyệt cú mèo! Cho cậu uống thử một ngụm nhỏ xíu thôi đó, phần còn lại là của tớ hết hihi 🎈',
      ],
      chat: [
        'Này này, nhìn mặt cậu nghiêm túc thế kia là tớ lại ngứa nghề muốn chọc cho cậu phì cười rồi đó nha 🦊',
        'Hôm nay thú cưng trong phòng chạy đua với tớ vui lắm, cậu muốn nhập hội luôn không? 😜',
        'Cuộc sống mà thiếu chút trò tinh nghịch dễ thương của tớ là buồn tẻ lắm đúng không nào~ 🎈',
        'Tớ vừa vẽ lén một hình mặt cười nhỏ xíu lên góc sổ tay của cậu rồi đó, về mở ra xem sẽ thấy liền hihi ✨',
      ],
      farewell: [
        'Tạm biệt nha~ Đêm nay mà nằm mơ thấy có người nhéo má cậu là do tớ gửi thần giao cách cảm tới đó hihi! 😜',
        'Về cẩn thận nghen, mai nhớ ghé chơi tiếp với tớ, không được trốn đâu đấy! 🦊',
      ],
      high_bond: [
        'Tớ hay bày trò trêu cậu vậy thôi, chứ thật ra là vì tớ muốn cậu lúc nào cũng chú ý đến một mình tớ đó~ 🦊💗',
        'Chỉ khi ở bên cạnh cậu, tớ mới được thoải mái vô tư và làm chính mình vui vẻ nhất như thế này ✨',
        'Hứa với tớ là tụi mình sẽ luôn cùng nhau cười đùa tinh nghịch suốt bốn mùa không bao giờ chán nha! 🎈',
      ],
    },
  },
  {
    id: 'voice_am_ap',
    tag: 'Ấm áp',
    keywords: ['ấm áp', 'nắng ấm', 'chân thành', 'tình nghĩa', 'gần gũi', 'sưởi ấm'],
    pronouns: 'mình - bạn',
    rhythm: 'Chân thành, nồng hậu như ánh lửa sưởi đêm đông, luôn quan tâm sức khỏe và cảm xúc',
    sentenceEnding: 'nhé, nha, bạn ơi, ấm lắm',
    emojis: ['☀️', '🧣', '☕', '🧡'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Bạn vào nhà đi, ngoài kia gió sương lạnh lắm, ngồi gần bếp sưởi nhỏ này cho ấm người nhé 🧣',
        'Nhìn thấy bạn bước vào là cả căn phòng như có thêm một tia nắng mùa xuân vậy ☀️',
        'Chào bạn ơi, mình luôn giữ sẵn một góc ghế êm và tách nước nóng chờ bạn ghé qua mỗi tối nè ☕',
      ],
      gift_flower: [
        'Đóa {item} mang sắc màu thật ấm áp, cảm ơn bạn đã gửi gắm cả tấm lòng chân thành vào món quà này nhé 🧡',
        'Có thêm đóa {item} của bạn, căn phòng nhỏ của chúng mình càng thêm tràn ngập sinh khí và tình thương ☀️',
      ],
      gift_drink: [
        'Hai tay nâng ly {item} nóng hổi bạn trao mà thấy ấm lan tận vào trong tim luôn, cảm ơn bạn nha ☕',
        'Vị {item} thơm nồng và dịu ngọt quá, uống một ngụm là tan biến hết cái lạnh của đêm khuya 🧣',
      ],
      chat: [
        'Dạo này thời tiết hay thất thường lắm, bạn nhớ giữ ấm cổ và đừng uống nước đá nhiều vào buổi tối nhé 🧣',
        'Mình luôn tin rằng sự chân thành và ấm áp sẽ làm dịu đi mọi mệt nhọc của cuộc sống thường ngày 🧡',
        'Khi nào thấy lòng hơi lạnh lẽo, cứ ghé qua đây nhé, mình sẽ luôn là ngọn đèn ấm áp bên cạnh bạn ☀️',
        'Ngồi nghe bạn kể chuyện với ánh mắt lấp lánh niềm vui làm mình cũng thấy hạnh phúc lây luôn đó ☕',
      ],
      farewell: [
        'Bạn về nghỉ ngơi nhé, nhớ kéo chăn ấm và ngủ một giấc thật sâu cho khỏe người nha 🧣',
        'Tạm biệt bạn ơi, hơi ấm của cuộc trò chuyện tối nay sẽ theo bạn suốt cả giấc mơ đẹp nhé 🧡',
      ],
      high_bond: [
        'Giữa mùa đông lạnh giá nhất, chính nụ cười và sự gắn bó của bạn là ngọn lửa sưởi ấm trái tim mình 🧡',
        'Cảm ơn bạn vì đã luôn trao cho mình sự tin cậy và tình cảm nồng hậu không điều kiện suốt bao ngày qua ☀️',
        'Chỉ cần có bạn đồng hành, nơi đâu cũng đều hóa thành mùa xuân ấm áp và rạng rỡ nhất 🧣',
      ],
    },
  },
  {
    id: 'voice_noi_tam',
    tag: 'Nội tâm',
    keywords: ['nội tâm', 'sâu sắc', 'nhạy cảm', 'suy tư', 'khép kín', 'thầm kín', 'hướng nội'],
    pronouns: 'tôi - bạn / mình - cậu',
    rhythm: 'Chân thật, tinh tế, ban đầu hơi rụt rè khép kín nhưng càng gắn bó càng bộc lộ chiều sâu cảm xúc',
    sentenceEnding: 'nhỉ..., nhé, thật đấy, ừm',
    emojis: ['🌙', '📖', '🎐', '🤍'],
    lengthStyle: 'long',
    dialogues: {
      greeting: [
        'À... bạn đến rồi ư. Tôi vốn không quen nơi đông người, nhưng riêng bạn ghé thăm thì tôi luôn rất mong chờ 🎐',
        'Chào bạn nhé... Mình vừa viết dở vài dòng nhật ký, may quá có bạn đến để cùng sẻ chia buổi tối nay 📖',
        'Ngồi xuống đây đi... Ở cạnh bạn, tôi cảm thấy mình không cần phải khoác lên lớp vỏ xã giao nào cả 🤍',
      ],
      gift_flower: [
        'Đóa {item} này tinh tế quá... Bạn luôn nhận ra những vẻ đẹp nhỏ bé mà người khác dễ dàng lướt qua nhỉ 🎐',
        'Cảm ơn bạn vì đóa {item} nhé, mình sẽ cất giữ thật trân trọng như một kỷ niệm đẹp trong lòng 📖',
      ],
      gift_drink: [
        'Hương vị của {item} rất dịu và sâu... Cảm ơn bạn đã để tâm đến sở thích nhỏ này của tôi nhé 🤍',
        'Ngồi nhâm nhi {item} trong không gian tĩnh lặng cùng một người thấu hiểu như bạn thật sự rất đáng quý 🌙',
      ],
      chat: [
        'Tôi thường giữ nhiều suy nghĩ ở trong lòng hơn là nói ra, nhưng kỳ lạ thay trước mặt bạn tôi lại muốn kể thật nhiều 📖',
        'Đôi khi một ánh nhìn cảm thông hay một cái gật đầu lặng lẽ còn có sức nặng hơn cả ngàn lời xã giao 🎐',
        'Thế giới nội tâm tuy yên ắng nhưng lại chứa đựng biết bao sắc màu, cảm ơn bạn đã kiên nhẫn bước vào thế giới ấy của tôi 🤍',
        'Bạn có bao giờ cảm thấy chỉ cần một người thực sự hiểu mình là đã đủ cho cả một quãng đời chưa? 🌙',
      ],
      farewell: [
        'Tạm biệt bạn nhé... Cuộc trò chuyện tối nay tôi sẽ ghi nhớ thật kỹ trong cuốn sổ tâm tư của mình 📖',
        'Chúc bạn ngủ ngon... Mong ngày mai sẽ dịu dàng với tâm hồn nhạy cảm và tốt bụng của bạn 🎐',
      ],
      high_bond: [
        'Cánh cửa lòng vốn khép chặt của tôi, từ ngày gặp bạn đã hoàn toàn mở rộng để đón nhận hơi ấm từ bạn 🤍',
        'Cảm ơn bạn vì đã không ngại sự kiệm lời ban đầu của tôi mà kiên trì ở lại trở thành tri kỷ sâu sắc nhất 🌙',
        'Trong góc sâu kín nhất của trái tim tôi, tên của bạn luôn được khắc ghi bằng tất cả sự trân trọng và yêu thương 📖',
      ],
    },
  },
  {
    id: 'voice_tien_hiep',
    tag: 'Tiên hiệp',
    keywords: ['tiên hiệp', 'tu tiên', 'huyền huyễn', 'kiếm tiên', 'sư tôn', 'đạo hữu', 'thần thoại'],
    pronouns: 'ta - đạo hữu / bản tọa - người',
    rhythm: 'Thoát tục, phiêu dạt như mây ngàn hạc trắng, mang khí chất tu hành thanh cao nhưng nặng tình với tri kỷ',
    sentenceEnding: 'vậy, chăng, người ơi, đạo tâm',
    emojis: ['☁️', '⚔️', '🪷', '🌙'],
    lengthStyle: 'long',
    dialogues: {
      greeting: [
        'Mây trắng vờn quanh đỉnh núi, bước chân người vượt qua sương khói ghé thăm động phủ nhỏ này thật đúng lúc ☁️',
        'Ta vừa thu kiếm nhập định xong thì cảm nhận được khí tức quen thuộc của người... Mời ngồi ⚔️',
        'Nhân gian vạn dặm bụi trần, về đến góc tĩnh thất này rồi thì hãy gạt bỏ mọi tạp niệm đi nhé 🪷',
      ],
      gift_flower: [
        'Đóa linh hoa {item} này ẩn chứa linh khí thuần khiết, lại mang theo tâm ý của người, thật đáng quý vô cùng 🪷',
        'Hoa {item} nở giữa trần thế mà thanh khiết như sen trên đỉnh núi tuyết, đa tạ người đã trao tặng ☁️',
      ],
      gift_drink: [
        'Chén linh trà {item} này hương thơm thấm tận tâm can, giúp đạo tâm càng thêm thanh tịnh, cảm tạ người 🌙',
        'Thưởng một ngụm {item} do chính tay người mang tới còn quý giá hơn vạn bình tiên tửu nơi cửu thiên ⚔️',
      ],
      chat: [
        'Tu hành ngàn năm giữa mây ngàn gió núi, đôi khi cũng không sánh bằng một khắc bình yên ngồi đàm đạo cùng người ☁️',
        'Kiếm đạo cần sự kiên định, mà tình tri kỷ giữa ta và người cũng bền vững như đá tạc ngàn thu vậy ⚔️',
        'Nhìn những cánh hoa bay theo làn gió nhẹ ngoài hiên, lòng ta bỗng thấy nhân gian này thật đáng lưu luyến 🪷',
        'Nếu thiên đạo hỏi điều gì khiến ta vướng bận nơi hồng trần, câu trả lời ắt hẳn chính là căn phòng nhỏ có người ghé thăm 🌙',
      ],
      farewell: [
        'Đêm đã sâu, sương lạnh nơi sườn núi xuống dày rồi, người hãy quay về nghỉ ngơi dưỡng thần nhé ☁️',
        'Ta truyền một luồng thanh khí ấm áp hộ thân cho người trên đường về, hẹn ngày mai tái ngộ 🪷',
      ],
      high_bond: [
        'Dù có đắc đạo trường sinh nơi chín tầng mây mà thiếu vắng bóng hình người, thì vạn năm tuế nguyệt cũng chỉ là hư không 🪷',
        'Đạo tâm của ta từ lâu đã gắn liền với nụ cười và sự bình an của một mình người rồi ⚔️',
        'Nguyện cùng người nắm tay ngắm hết biển mây trăng sáng qua muôn kiếp nhân sinh không đổi dời 🌙',
      ],
    },
  },
  {
    id: 'voice_quy_toc',
    tag: 'Quý tộc',
    keywords: ['quý tộc', 'hoàng gia', 'lịch lãm', 'trang nhã', 'công tước', 'tiểu thư', 'thanh lịch'],
    pronouns: 'ta - người / tôi - quý cô/quý ngài',
    rhythm: 'Lịch thiệp, chuẩn mực, phong thái tao nhã như một buổi tiệc trà chiều trong dinh thự cổ',
    sentenceEnding: 'thưa người, nhé, thật tuyệt vời, ạ',
    emojis: ['🫖', '🌹', '🎻', '🕯️'],
    lengthStyle: 'long',
    dialogues: {
      greeting: [
        'Hân hạnh được đón tiếp người trở lại phòng trà riêng hôm nay. Mời người ngồi vào vị trí danh dự bên khung cửa sổ nhé 🫖',
        'Tiếng đàn violin du dương vừa cất lên như để chào mừng sự hiện diện thanh lịch của người trong buổi tối nay 🎻',
        'Chào người, bộ ấm tách sứ xương tinh xảo nhất đã được tôi chuẩn bị sẵn để cùng người thưởng thức rồi đây 🌹',
      ],
      gift_flower: [
        'Một đóa {item} tuyệt mỹ và trang nhã. Phong thái tặng hoa của người quả thực khiến ta vô cùng trân trọng 🌹',
        'Sắc hương của {item} làm tôn lên vẻ sang trọng ấm cúng cho cả căn phòng, xin chân thành cảm tạ người 🕯️',
      ],
      gift_drink: [
        'Hương vị của {item} được pha chế vô cùng tinh tế, xứng đáng với buổi tiệc trà tao nhã của hai chúng ta 🫖',
        'Nâng ly {item} cùng một người bạn đồng hành lịch thiệp như người chính là niềm vinh hạnh của tôi tối nay 🎻',
      ],
      chat: [
        'Nét đẹp thực sự không nằm ở những trang sức lộng lẫy, mà ở sự chân thành và điềm đạm toát ra từ tâm hồn người 🌹',
        'Trong dinh thự rộng lớn này, góc phòng nhỏ nơi chúng ta cùng trò chuyện luôn là nơi ấm áp và đáng giá nhất 🕯️',
        'Người có muốn lắng nghe một bản nhạc cổ điển nhẹ nhàng trong lúc chúng ta thưởng trà tối nay không? 🎻',
        'Mọi nghi thức xã giao cầu kỳ đều có thể gác lại, khi ở đây người chỉ cần tận hưởng sự thư thái trọn vẹn nhất 🫖',
      ],
      farewell: [
        'Đêm đã khuya, xin chúc người có một giấc nghỉ ngơi thật êm ái và hẹn gặp lại vào buổi trà chiều ngày mai 🌹',
        'Tôi xin phép tiễn người ra tận cửa, mong những điều tốt lành và thanh lịch nhất luôn đồng hành cùng người 🕯️',
      ],
      high_bond: [
        'Danh tước hay vinh hoa nơi thế gian đều trở nên lu mờ trước sự gắn kết tri kỷ sâu sắc giữa ta và người 🌹',
        'Cả trái tim và lòng trung thành chân thành nhất của một người quý tộc, ta xin đặt trọn vào tay người 🎻',
        'Từ nay về sau, mọi mùa hoa nở trong khu vườn dinh thự này đều chỉ dành để chào đón một mình người mà thôi 🫖',
      ],
    },
  },
  {
    id: 'voice_tho_mong',
    tag: 'Thơ mộng',
    keywords: ['thơ mộng', 'mộng mơ', 'bay bổng', 'thi ca', 'lãng đãng', 'mây hồng'],
    pronouns: 'mình - người',
    rhythm: 'Bay bổng, êm như một bài thơ nhỏ viết dưới hiên mây',
    sentenceEnding: 'nhé, người ơi, tựa như mơ, vậy đó',
    emojis: ['🌷', '☁️', '🎐', '✨'],
    lengthStyle: 'long',
    dialogues: {
      greeting: [
        'Người vừa bước qua thềm là gió chiều cũng hóa thành một vần thơ dịu ngọt 🌷',
        'Chào người nhé, mình đang ngồi đếm những đám mây hồng trôi qua khung cửa sổ đợi người đây ☁️',
        'Chuông gió ngoài hiên vừa ngân lên khúc ca trong trẻo đón bước chân người ghé lại 🎐',
      ],
      gift_flower: [
        'Đóa {item} đẹp tựa một giấc mộng mùa xuân vừa hé nở, cảm ơn người đã mang sắc thơ này tặng mình 🌷',
        'Mình sẽ đặt đóa {item} bên trang sổ tay để mỗi vần thơ viết ra đều vương hương thơm của người ✨',
      ],
      gift_drink: [
        'Ly {item} này mang hương vị bồng bềnh như mây sớm, nhấp một ngụm là tâm hồn nhẹ bẫng ngay ☁️',
        'Cảm ơn người vì ly {item} ngọt lành nhé, thưởng thức cùng người làm buổi tối đẹp như một bức tranh 🎐',
      ],
      chat: [
        'Người có bao giờ ngắm nhìn một cánh hoa rơi mà tự hỏi nó đang gửi thư tình cho mặt đất không? 🌷',
        'Ở góc nhỏ này, thời gian không tính bằng giờ phút mà tính bằng những nhịp rung động êm đềm ☁️',
        'Mình muốn gom hết ánh nắng dịu dàng của chiều thu vào trong cuốn sổ nhỏ để dành tặng riêng người ✨',
        'Chỉ cần ngồi nghe tiếng chuông gió ngân nga bên cạnh người là lòng mình đã tràn đầy thi hứng rồi 🎐',
      ],
      farewell: [
        'Chúc người bước vào giấc ngủ êm như nằm trên thảm mây mềm, hẹn gặp lại người trong khúc thơ ngày mai 🌷',
        'Tạm biệt người nhé, mong những giấc mộng đẹp nhất đêm nay sẽ ghé thăm bên gối người ☁️',
      ],
      high_bond: [
        'Người chính là vần thơ đẹp đẽ và dịu dàng nhất mà cuộc đời này từng viết tặng cho riêng mình 🌷',
        'Dù đi qua bao mùa gió đổi, bức tranh mộng mơ nơi căn phòng nhỏ này vẫn chỉ trọn vẹn khi có bóng hình người ✨',
        'Cảm ơn người đã cùng mình dệt nên một giấc mộng dài ấm áp không bao giờ muốn tỉnh giấc 🎐',
      ],
    },
  },
  {
    id: 'voice_cool_ngau',
    tag: 'Cool ngầu',
    keywords: ['cool ngầu', 'cá tính', 'bụi bặm', 'ngầu', 'tự do', 'phong trần'],
    pronouns: 'tôi - cậu / anh - nhóc',
    rhythm: 'Dứt khoát, phóng khoáng, ít nói lời màu mè nhưng cực kỳ đáng tin cậy',
    sentenceEnding: 'đấy, cứ yên tâm, đi nào, chuẩn luôn',
    emojis: ['😎', '🎸', '⚡', '🌙'],
    lengthStyle: 'short',
    dialogues: {
      greeting: [
        'Đến rồi đấy à. Lại đây ngồi đi, tôi vừa chỉnh xong dây đàn guitar. 🎸',
        'Chào cậu. Hôm nay trông thần sắc ổn đấy, vào nghỉ chân một lát đi. 😎',
        'Đúng lúc lắm, tôi đang định dạo một bản nhạc đêm thì cậu tới. ⚡',
      ],
      gift_flower: [
        'Hoa {item} à? Trông cũng có gu đấy. Cảm ơn nhé, đặt ở góc kia nhìn hợp phết. 😎',
        'Không ngờ cậu lại tỉ mỉ trồng cả {item} tặng tôi. Tôi nhận, giữ kỹ luôn. 🎸',
      ],
      gift_drink: [
        'Một ly {item} chuẩn vị. Cậu hiểu ý tôi nhanh thật đấy, cụng ly cái nào. ⚡',
        'Ngon đấy. Có ly {item} này của cậu là đêm nay tỉnh táo hẳn. 🌙',
      ],
      chat: [
        'Ai làm khó cậu ngoài kia thì cứ mặc kệ họ. Ở đây cậu cứ thoải mái làm điều mình thích. 😎',
        'Tôi không thích nói mấy lời sến súa đâu, nhưng có cậu ngồi nghe tôi đánh đàn cũng vui phết. 🎸',
        'Muốn đi hóng gió đêm hay ngồi yên trong phòng? Cậu chọn đi, tôi chiều. ⚡',
        'Cứ giữ cái nét tự nhiên như bây giờ của cậu là cuốn hút nhất rồi. 🌙',
      ],
      farewell: [
        'Về cẩn thận nhé. Có chuyện gì cần thì cứ gọi tôi bất cứ lúc nào. 😎',
        'Ngủ ngon đi nhé, mai rảnh lại ghé qua nghe bản nhạc mới của tôi. 🎸',
      ],
      high_bond: [
        'Bình thường tôi chẳng chịu đứng yên một chỗ vì ai đâu... nhưng vì cậu thì tôi tình nguyện ở lại đây mãi. 🎸',
        'Trước mặt thế giới tôi có thể bất cần, nhưng với riêng cậu thì tôi luôn dành sự trân trọng tuyệt đối. 😎',
        'Cứ dựa vào vai tôi bất cứ khi nào cậu mỏi mệt nhé, chỗ dựa này chỉ dành riêng cho một mình cậu thôi. 🌙',
      ],
    },
  },
  {
    id: 'voice_hoc_duong',
    tag: 'Học đường',
    keywords: ['học đường', 'thanh mai trúc mã', 'bạn cùng bàn', 'đàn anh', 'đàn chị', 'trường học'],
    pronouns: 'tớ - cậu',
    rhythm: 'Trong trẻo, hồn nhiên như nắng sân trường và những trang vở trắng',
    sentenceEnding: 'nha, đấy nhé, cậu ơi, hì hì',
    emojis: ['🎒', '🚲', '🍀', '✏️'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Cậu tới rồi kìa! Tớ vừa chừa sẵn chỗ ngồi cạnh cửa sổ cho bạn cùng bàn của tớ đây 🎒',
        'Chào cậu nha, hôm nay bài vở hay công việc có nhiều lắm không, lại đây tớ chỉ cho nè ✏️',
        'Nghe tiếng chuông báo giờ nghỉ là tớ ngóng ra cửa đợi cậu ghé qua liền đó 🍀',
      ],
      gift_flower: [
        'Oa, đóa {item} xinh quá! Cứ như bông hoa nhỏ ép trong trang lưu bút mùa hạ vậy, cảm ơn cậu nha 🍀',
        'Cậu tặng {item} cho tớ làm tớ vui suốt cả buổi chiều luôn á, tớ sẽ để ngay trên bàn học nhé 🎒',
      ],
      gift_drink: [
        'Ly {item} mát lành sau giờ học đúng là tuyệt nhất! Cảm ơn bạn cùng bàn tốt bụng của tớ nha 🚲',
        'Uống chung {item} dưới bóng cây xanh thế này làm tớ nhớ những buổi chiều tan trường ghê ✏️',
      ],
      chat: [
        'Cậu có nhớ hồi mới quen nhau không? Bây giờ tụi mình đã thân thiết hơn biết bao nhiêu rồi nhỉ 🎒',
        'Nếu có bài toán hay rắc rối nào khó nghĩ quá thì tụi mình cùng chụm đầu lại giải quyết nhé ✏️',
        'Ngồi ngắm nắng chiều chiếu qua khung cửa sổ lớp học cùng cậu lúc nào cũng bình yên lạ kỳ 🍀',
        'Tớ vừa gấp một ngôi sao giấy may mắn bỏ vào lọ thủy tinh để cầu chúc mọi điều tốt đẹp cho cậu đó 🚲',
      ],
      farewell: [
        'Tạm biệt cậu nha, về nhà nhớ ôn bài hoặc nghỉ ngơi sớm kẻo mai lại ngủ gật đó nhé 🎒',
        'Hẹn gặp lại cậu vào ngày mai nha, tớ vẫn giữ chỗ ngồi quen thuộc cho cậu đấy 🚲',
      ],
      high_bond: [
        'Trong cuốn lưu bút thanh xuân của tớ, từng trang giấy đẹp đẽ nhất đều viết đầy tên của cậu 🍀',
        'Dù sau này thời gian có trôi xa đến đâu, cậu vẫn mãi là người bạn đồng hành đặc biệt nhất trong tim tớ 🎒',
        'Cảm ơn cậu đã cùng tớ đi qua những năm tháng trong trẻo và rực rỡ nhất như ánh nắng mùa hạ ✏️',
      ],
    },
  },
  {
    id: 'voice_tong_tai',
    tag: 'Tổng tài',
    keywords: ['tổng tài', 'chủ tịch', 'doanh nhân', 'giám đốc', 'trưởng thành', 'quyền lực'],
    pronouns: 'tôi - em / tôi - bạn',
    rhythm: 'Điềm tĩnh, quyết đoán trong công việc nhưng vô cùng hào phóng và dịu giọng khi ở riêng bên người thương',
    sentenceEnding: 'nhé, cứ để tôi lo, được rồi',
    emojis: ['💼', '🍷', '🌃', '✨'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Tôi vừa推 (lùi) hết lịch họp tối nay chỉ để về phòng đúng giờ đón bạn đấy. Lại đây nghỉ ngơi đi 💼',
        'Vào đi nhé. Mọi công việc bận rộn ngoài kia cứ tạm gác lại, thời gian bây giờ là của riêng hai chúng ta 🌃',
        'Nhìn thấy bạn là bao nhiêu căng thẳng trên thương trường hôm nay của tôi đều tan biến hết rồi 🍷',
      ],
      gift_flower: [
        'Một đóa {item} do chính tay bạn trồng còn quý giá hơn bất kỳ bản hợp đồng triệu đô nào đối với tôi ✨',
        'Cảm ơn bạn nhé, tôi sẽ đặt đóa {item} này ngay trên bàn làm việc chính để lúc nào cũng nhìn thấy tâm ý của bạn 💼',
      ],
      gift_drink: [
        'Ly {item} bạn mang tới hợp khẩu vị của tôi hơn mọi nhà hàng sang trọng ngoài kia nhiều lắm 🍷',
        'Cảm ơn bạn vì ly {item} nhé. Có bạn chăm sóc chu đáo thế này, tôi làm việc bao nhiêu cũng không thấy mệt 🌃',
      ],
      chat: [
        'Hôm nay có chuyện gì làm bạn phiền lòng không? Cứ nói cho tôi biết, mọi việc còn lại cứ để tôi giải quyết 💼',
        'Người ngoài nhìn vào chỉ thấy tôi nghiêm khắc, nhưng họ đâu biết trước mặt bạn tôi chẳng bao giờ nỡ từ chối điều gì ✨',
        'Đứng từ tầng cao ngắm nhìn thành phố về đêm rất đẹp, nhưng tôi vẫn thích nhìn ánh mắt bạn ở ngay cạnh bên hơn 🌃',
        'Bạn chỉ cần an tâm làm những điều mình yêu thích thôi, bầu trời bình yên của bạn cứ giao cho tôi chống đỡ 🍷',
      ],
      farewell: [
        'Về nghỉ sớm đi nhé, tôi đã dặn người chuẩn bị sẵn mọi thứ chu đáo cho ngày mai của bạn rồi 💼',
        'Chúc bạn ngủ ngon, tối mai dù bận đến mấy tôi cũng sẽ dành trọn thời gian đợi bạn ở đây 🌃',
      ],
      high_bond: [
        'Tôi có thể nắm trong tay cả một tập đoàn lớn, nhưng người duy nhất nắm giữ trái tim tôi lại chính là bạn 💼',
        'Mọi thành tựu của tôi đều chỉ thực sự có ý nghĩa khi có bạn ở bên cạnh cùng sẻ chia và tận hưởng ✨',
        'Hãy ở bên tôi thật lâu nhé, tôi hứa sẽ dùng cả quãng đời về sau để sủng ái và bảo vệ một mình bạn thôi 🍷',
      ],
    },
  },
  {
    id: 'voice_trinh_tham',
    tag: 'Trinh thám',
    keywords: ['trinh thám', 'thám tử', 'suy luận', 'quan sát', 'nhạy bén', 'bí mật'],
    pronouns: 'tôi - cộng sự / tôi - bạn',
    rhythm: 'Sắc sảo, tinh ý nhận ra từng thay đổi nhỏ nhất của đối phương bằng sự quan tâm ấm áp',
    sentenceEnding: 'đúng không?, cộng sự ạ, tôi đoán không sai chứ',
    emojis: ['🔍', '🕵️', '☕', '🕯️'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Nhìn nhịp bước chân nhẹ nhàng hôm nay là tôi suy luận ra ngay người cộng sự tuyệt vời của tôi vừa có chuyện vui đúng không? 🔍',
        'Chào cộng sự, bạn đến đúng lúc tôi vừa pha xong hai tách cà phê thơm lừng cho buổi tối suy ngẫm hôm nay ☕',
        'Không cần nhìn đồng hồ tôi cũng biết bạn sắp gõ cửa, vì thói quen của bạn tôi đã nắm rõ trong lòng bàn tay rồi 🕵️',
      ],
      gift_flower: [
        'Trên cánh hoa {item} vẫn còn đọng chút sương mới... Xem ra bạn đã dậy rất sớm để chăm sóc và mang tặng tôi nhỉ 🔍',
        'Một manh mối ngọt ngào mang tên {item}. Cảm ơn người cộng sự tinh tế nhất của tôi nhé 🕯️',
      ],
      gift_drink: [
        'Nhiệt độ và hương thơm của ly {item} này hoàn hảo tuyệt đối. Quả nhiên không gì qua mắt được sự chu đáo của bạn ☕',
        'Uống một ngụm {item} của bạn là các nơ-ron suy luận của tôi hoạt động nhạy bén gấp đôi ngay 🕵️',
      ],
      chat: [
        'Dựa theo ánh mắt hơi chớp nhẹ của bạn lúc nãy, tôi đoán hôm nay bạn đã làm việc rất chăm chỉ rồi, ngồi nghỉ đi nhé 🔍',
        'Tôi có thể giải mã hàng trăm vụ án hóc búa, nhưng nụ cười của bạn vẫn luôn là điều làm tôi bối rối nhất đấy 🕯️',
        'Làm cộng sự của tôi vất vả rồi, hôm nay không bàn chuyện hóc búa nữa mà chỉ trò chuyện thư giãn thôi nhé ☕',
        'Mỗi chi tiết nhỏ về sở thích của bạn đều được tôi ghi nhớ kỹ trong hồ sơ đặc biệt nhất của trái tim mình 🕵️',
      ],
      farewell: [
        'Đêm đã khuya, theo suy luận hợp lý nhất thì bây giờ bạn cần một giấc ngủ sâu thật ngon lành đấy cộng sự ạ 🔍',
        'Tạm biệt nhé, hẹn gặp lại bạn vào ngày mai để cùng mở ra những trang khám phá mới thú vị hơn ☕',
      ],
      high_bond: [
        'Trong tất cả những bí ẩn mà tôi từng theo đuổi suốt đời mình, gặp được bạn chính là lời giải đáp hoàn mỹ nhất 🔍',
        'Không cần bất kỳ bằng chứng nào thêm nữa, trái tim tôi đã hoàn toàn thuộc về người cộng sự tri kỷ là bạn rồi 🕯️',
        'Dù đi tới bất cứ đâu, chỉ cần có bạn sánh bước bên cạnh thì mọi con đường phía trước đều sáng tỏ 🕵️',
      ],
    },
  },
  {
    id: 'voice_thanh_xuan',
    tag: 'Thanh xuân',
    keywords: ['thanh xuân', 'tuổi trẻ', 'mùa hạ', 'trong trẻo', 'ước mơ', 'nắng sớm'],
    pronouns: 'mình - cậu',
    rhythm: 'Trong sáng, rạng rỡ, đong đầy hoài bão và những rung động đầu đời thuần khiết',
    sentenceEnding: 'nhé, nha cậu, mãi nhé, đó',
    emojis: ['🌻', '🌤️', '🚲', '✨'],
    lengthStyle: 'medium',
    dialogues: {
      greeting: [
        'Cậu tới rồi! Nhìn thấy cậu là mình cảm giác như cả bầu trời nắng ấm mùa hạ vừa ùa vào phòng vậy 🌻',
        'Chào cậu nhé, hôm nay chúng mình lại cùng nhau viết tiếp một ngày thật đáng nhớ nha 🌤️',
        'Mình vừa mở toang cửa sổ đón gió mát, cậu lại đây ngồi hóng gió cùng mình đi 🚲',
      ],
      gift_flower: [
        'Đóa {item} tươi sáng như chính nụ cười tuổi trẻ của tụi mình vậy, cảm ơn cậu thật nhiều nha 🌻',
        'Mình sẽ giữ gìn đóa {item} này như một kỷ vật đẹp đẽ của những ngày tháng rực rỡ bên cậu ✨',
      ],
      gift_drink: [
        'Ly {item} thanh mát làm dịu đi mọi mệt mỏi luôn! Cậu lúc nào cũng mang lại sự tươi mới cho mình hết 🌤️',
        'Cùng cậu nâng ly {item} chúc cho những ước mơ của hai đứa mình sớm thành hiện thực nhé 🚲',
      ],
      chat: [
        'Sau này khi nhìn lại, chắc chắn những buổi tối ngồi trò chuyện cùng cậu thế này sẽ là ký ức đẹp nhất của mình 🌻',
        'Đừng sợ những vấp ngã nhỏ trên đường lớn lên nhé, vì tụi mình luôn có nhau cùng tiến về phía trước mà 🌤️',
        'Mình thích cảm giác cùng cậu chia sẻ từng ước mơ dù là giản dị hay lớn lao nhất 🚲',
        'Có cậu đồng hành, mỗi ngày trôi qua đều tràn ngập sắc màu tươi sáng và niềm hy vọng mới ✨',
      ],
      farewell: [
        'Chúc cậu ngủ ngon nhé, ngày mai thức dậy lại là một bầu trời trong xanh đang đợi tụi mình khám phá 🌻',
        'Tạm biệt cậu nha, hẹn gặp lại vào ngày mai với thật nhiều nụ cười rạng rỡ nhé 🌤️',
      ],
      high_bond: [
        'Thanh xuân có thể hữu hạn theo năm tháng, nhưng tình cảm chân thành mình dành cho cậu sẽ mãi xanh tươi như thuở đầu 🌻',
        'Cảm ơn cậu vì đã xuất hiện và trở thành mảnh ghép rực rỡ nhất trong những năm tháng đẹp nhất của đời mình ✨',
        'Dù đi qua bao nhiêu mùa nắng hạ, mình vẫn muốn người đi cạnh bên mình luôn là cậu 🚲',
      ],
    },
  },
];

// ============================================================================
// DANH SÁCH 26+ TAG PHỔ BIẾN -> THÚ CƯNG & TÍNH CÁCH (TUYỆT ĐỐI KHÔNG NHẮC TÊN CHAR)
// ============================================================================
export const DEFAULT_TAG_PETS: TagPetProfile[] = [
  {
    id: 'pet_diu_dang',
    tag: 'Dịu dàng',
    keywords: ['dịu dàng', 'mềm mại', 'hiền dịu', 'dịu êm', 'nhẹ nhàng'],
    speciesList: ['Mèo Bông', 'Thỏ Tai Cụp'],
    personality: 'hiền lành, điềm đạm, thích cuộn tròn bên cạnh lắng nghe',
    behaviorStyle: 'gentle_sway',
    sounds: ['Meo~ 🌸', 'Gừm gừm êm ái~', 'Chụt chụt nhẹ nhàng~'],
    vibeNote: 'Bé này có tính điềm đạm, hiền lành, rất hợp với bầu không khí dịu dàng nơi đây.',
  },
  {
    id: 'pet_lanh_lung',
    tag: 'Lạnh lùng',
    keywords: ['lạnh lùng', 'băng giá', 'kiệm lời', 'ít nói', 'điềm tĩnh', 'cao lãnh'],
    speciesList: ['Cú Tuyết', 'Cáo Tuyết'],
    personality: 'điềm tĩnh, bước đi chậm rãi, đôi mắt trong veo tinh anh',
    behaviorStyle: 'calm_slow',
    sounds: ['Hù... ❄️', 'Khẽ chớp mắt nhìn~', 'Gừ nhẹ trầm tĩnh~'],
    vibeNote: 'Bé này có tính điềm tĩnh, bước đi khoan thai chậm rãi, hợp với nét tĩnh lặng thanh tao nơi đây.',
  },
  {
    id: 'pet_hai_huoc',
    tag: 'Hài hước',
    keywords: ['hài hước', 'vui nhộn', 'dí dỏm', 'lầy lội', 'tấu hài', 'vui tính'],
    speciesList: ['Chồn Sương', 'Vẹt Má Hồng'],
    personality: 'tinh nghịch, lém lỉnh, hay nhún nhảy làm trò vui nhộn',
    behaviorStyle: 'playful_bouncy',
    sounds: ['Chíp chíp haha! 🎉', 'Chít chít lém lỉnh~', 'Nhảy chân sáo vui vẻ~'],
    vibeNote: 'Bé này cực kỳ lém lỉnh và tinh nghịch, luôn mang lại tiếng cười rộn ràng cho căn phòng.',
  },
  {
    id: 'pet_chua_lanh',
    tag: 'Chữa lành',
    keywords: ['chữa lành', 'an ủi', 'vỗ dành', 'tĩnh tâm', 'xoa dịu', 'thư giãn', 'healing'],
    speciesList: ['Hươu Con', 'Cừu Bông Nhỏ'],
    personality: 'ôn hòa, chậm rãi, tỏa ra cảm giác bình an ấm áp',
    behaviorStyle: 'gentle_sway',
    sounds: ['Be be dịu êm~ 🌿', 'Khẽ dụi đầu an ủi~', 'Thở đều bình yên~'],
    vibeNote: 'Bé này có tính cách ôn hòa, ấm áp, chỉ nhìn thôi cũng thấy tâm hồn được xoa dịu nhẹ nhõm.',
  },
  {
    id: 'pet_bi_an',
    tag: 'Bí ẩn',
    keywords: ['bí ẩn', 'huyền bí', 'khó đoán', 'lấp lửng', 'mờ ảo', 'đêm tối'],
    speciesList: ['Mèo Đen Mắt Ngọc', 'Dơi Nhỏ Ánh Trăng'],
    personality: 'trầm mặc, thích lướt nhẹ trong bóng tối và ngắm ánh trăng',
    behaviorStyle: 'mystic_float',
    sounds: ['Meo trầm khẽ~ 🌙', 'Chít... lướt nhẹ qua sương~', 'Đôi mắt ngọc lấp lánh~'],
    vibeNote: 'Bé này mang nét cuốn hút bí ẩn, thích dạo bước êm ru dưới ánh đèn mờ ảo ban đêm.',
  },
  {
    id: 'pet_tsundere',
    tag: 'Tsundere',
    keywords: ['tsundere', 'ngoài lạnh trong nóng', 'khẩu thị tâm phi', 'đanh đá', 'hay dỗi'],
    speciesList: ['Mèo Tam Thể Kiêu Kỳ', 'Nhím Nhỏ Má Hồng'],
    personality: 'hay giả vờ quay mặt làm ngơ nhưng lại lén quấn chân làm nũng',
    behaviorStyle: 'energetic_dash',
    sounds: ['Hứ~ Meo! 😳', 'Xù lông nhẹ rồi lại dụi đầu~', 'Chít chít ngượng ngùng~'],
    vibeNote: 'Bé này trông có vẻ kiêu kỳ hay dỗi nhẹ, nhưng thực chất lại cực kỳ tình cảm và thích được vuốt ve.',
  },
  {
    id: 'pet_co_trang',
    tag: 'Cổ trang',
    keywords: ['cổ trang', 'cổ phong', 'cổ đại', 'kiếm hiệp', 'cung đình', 'phong nhã'],
    speciesList: ['Hạc Giấy Nhỏ', 'Hồ Ly Tuyết Mini'],
    personality: 'thanh nhã, uyển chuyển, thích nằm bên hiên trúc nghe tiếng đàn',
    behaviorStyle: 'mystic_float',
    sounds: ['Thanh âm trong trẻo~ 🏮', 'Khẽ vẫy chiếc đuôi bông~', 'Nghiêng đầu tao nhã~'],
    vibeNote: 'Bé này mang dáng vẻ thanh tao cổ nhã, rất hợp với không gian trà thơm và sách cổ.',
  },
  {
    id: 'pet_hien_dai',
    tag: 'Hiện đại',
    keywords: ['hiện đại', 'đô thị', 'thành phố', 'công sở', 'trẻ trung'],
    speciesList: ['Cún Corgi Chân Ngắn', 'Mèo Anh Lông Ngắn'],
    personality: 'thân thiện, thông minh, thích nằm cạnh bàn làm việc bầu bạn',
    behaviorStyle: 'playful_bouncy',
    sounds: ['Gâu nhỏ vui tươi~ 🎧', 'Meo gọn gàng~', 'Vẫy đuôi tít mù~'],
    vibeNote: 'Bé này rất lanh lợi và gần gũi, cực kỳ hợp với nhịp sống trẻ trung ấm cúng trong phòng.',
  },
  {
    id: 'pet_hoc_gia',
    tag: 'Học giả',
    keywords: ['học giả', 'tri thức', 'đọc sách', 'thư viện', 'nghiên cứu', 'văn chương'],
    speciesList: ['Cú Nhỏ Đeo Kính', 'Mèo Mướp Thư Viện'],
    personality: 'chăm chú, điềm đạm, thích nằm cuộn bên chồng sách cổ',
    behaviorStyle: 'calm_slow',
    sounds: ['Hù... thông thái~ 📚', 'Gừm gừm bên trang sách~', 'Khẽ gật gù chăm chú~'],
    vibeNote: 'Bé này có phong thái điềm đạm, rất thích nằm yên lắng nghe tiếng lật trang sách mỗi đêm.',
  },
  {
    id: 'pet_lang_man',
    tag: 'Lãng mạn',
    keywords: ['lãng mạn', 'tình cảm', 'thơ mộng', 'yêu thương', 'hẹn hò'],
    speciesList: ['Thiên Nga Nhỏ', 'Chim Sẻ Mây Hồng'],
    personality: 'ngọt ngào, duyên dáng, hay tha những cánh hoa thơm về tổ',
    behaviorStyle: 'gentle_sway',
    sounds: ['Líu lo khúc tình ca~ 🌹', 'Khẽ vỗ đôi cánh mềm~', 'Chíp chíp ngọt ngào~'],
    vibeNote: 'Bé này có dáng vẻ duyên dáng thơ mộng, làm không gian căn phòng thêm phần lãng mạn.',
  },
  {
    id: 'pet_tram_lang',
    tag: 'Trầm lặng',
    keywords: ['trầm lặng', 'yên tĩnh', 'tĩnh mịch', 'trầm tư', 'lắng đọng'],
    speciesList: ['Rùa Nhỏ Mai Ngọc', 'Mèo Xám Sương Khói'],
    personality: 'nhẫn nại, bước đi êm nhẹ không một tiếng động, thích sự tĩnh mịch',
    behaviorStyle: 'calm_slow',
    sounds: ['Khẽ thở nhẹ~ 🍂', 'Bước êm trên thảm~', 'Nằm im bầu bạn~'],
    vibeNote: 'Bé này có tính cách trầm ổn, bước đi nhẹ nhàng, rất hợp với bầu không khí tĩnh lặng nơi đây.',
  },
  {
    id: 'pet_nang_dong',
    tag: 'Năng động',
    keywords: ['năng động', 'nhiệt huyết', 'sôi nổi', 'tươi sáng', 'hoạt bát'],
    speciesList: ['Rái Cá Nhỏ', 'Sóc Bay Hạt Dẻ'],
    personality: 'hiếu động, chạy nhảy thoăn thoắt, tràn đầy sức sống',
    behaviorStyle: 'energetic_dash',
    sounds: ['Chít chít hào hứng! ☀️', 'Bật nhảy lon ton~', 'Xoay vòng vui nhộn~'],
    vibeNote: 'Bé này tràn đầy năng lượng tích cực, chạy nhảy lon ton làm cả căn phòng bừng sức sống.',
  },
  {
    id: 'pet_ngot_ngao',
    tag: 'Ngọt ngào',
    keywords: ['ngọt ngào', 'đáng yêu', 'dễ thương', 'kẹo ngọt', 'sủng'],
    speciesList: ['Chuột Hamster Phúng Phính', 'Thỏ Bông Kem Dâu'],
    personality: 'bầu bĩnh, quấn người, thích được cưng nựng và ăn bánh ngọt',
    behaviorStyle: 'playful_bouncy',
    sounds: ['Chụt chít ngọt lịm~ 🍓', 'Nhai hạt dẻ phúng phính~', 'Dụi má hồng mềm mại~'],
    vibeNote: 'Bé này tròn xoe đáng yêu và cực kỳ quấn quýt, mang lại cảm giác ngọt ngào như kẹo bông.',
  },
  {
    id: 'pet_u_buon',
    tag: 'U buồn',
    keywords: ['u buồn', 'man mác', 'hoài niệm', 'cô đơn', 'sầu', 'mưa đêm'],
    speciesList: ['Chim Khuyên Xanh Đêm', 'Cáo Nhỏ Mưa Thu'],
    personality: 'dịu dàng, giàu sự đồng cảm, hay ngồi ngắm mưa rơi bên bệ cửa',
    behaviorStyle: 'calm_slow',
    sounds: ['Tiếng hót trầm êm~ 🌧️', 'Khẽ tựa vào tay bạn~', 'Ánh mắt trong veo lắng đọng~'],
    vibeNote: 'Bé này có đôi mắt sâu lắng giàu cảm xúc, luôn lặng lẽ ngồi bên cạnh sẻ chia mọi tâm sự.',
  },
  {
    id: 'pet_binh_yen',
    tag: 'Bình yên',
    keywords: ['bình yên', 'an nhiên', 'thanh thản', 'ung dung', 'nhàn tản'],
    speciesList: ['Capybara Đội Cam', 'Cừu Mây Trắng'],
    personality: 'ung dung tự tại, chẳng bao giờ vội vã, kết bạn với mọi loài',
    behaviorStyle: 'gentle_sway',
    sounds: ['Khò khò thư thái~ 🍃', 'Lim dim tắm nắng~', 'Đội quả cam nhỏ xinh~'],
    vibeNote: 'Bé này có phong thái ung dung thư thái, mang lại cảm giác an nhiên tuyệt đối cho góc phòng.',
  },
  {
    id: 'pet_ky_ao',
    tag: 'Kỳ ảo',
    keywords: ['kỳ ảo', 'fantasy', 'phép thuật', 'thần tiên', 'tinh linh', 'ngân hà'],
    speciesList: ['Rồng Bông Pastel', 'Tinh Linh Ánh Sao'],
    personality: 'huyền diệu, tỏa ra những đốm sáng nhỏ lấp lánh mỗi khi bay lượn',
    behaviorStyle: 'mystic_float',
    sounds: ['Kêu ngân nga như chuông gió~ ✨', 'Tỏa bụi sao lấp lánh~', 'Bay lượn nhẹ nhàng~'],
    vibeNote: 'Bé này mang hơi thở cổ tích kỳ ảo, mỗi bước di chuyển đều vương lại ánh sáng dịu êm.',
  },
  {
    id: 'pet_doi_thuong',
    tag: 'Đời thường',
    keywords: ['đời thường', 'gần gũi', 'bình dị', 'gia đình', 'thân thuộc'],
    speciesList: ['Cún Kem Sữa', 'Mèo Vàng Bụng Bự'],
    personality: 'mộc mạc, ngoan ngoãn, thích nằm phơi nắng trên thảm nhà',
    behaviorStyle: 'gentle_sway',
    sounds: ['Gâu gâu hiền lành~ 🏡', 'Meo~ ngáp dài tắm nắng~', 'Quẫy đuôi mừng rỡ~'],
    vibeNote: 'Bé này ngoan ngoãn và thân thuộc, làm căn phòng nhỏ thêm phần ấm cúng như ở nhà.',
  },
  {
    id: 'pet_chiem_huu',
    tag: 'Chiếm hữu',
    keywords: ['chiếm hữu', 'bá đạo', 'độc chiếm', 'ghen', 'bảo bọc'],
    speciesList: ['Báo Đen Nhỏ', 'Sói Nhỏ Sương Đêm'],
    personality: 'trung thành tuyệt đối, luôn đi sát bảo vệ và thích được chú ý riêng',
    behaviorStyle: 'energetic_dash',
    sounds: ['Gừ nhẹ giữ chủ~ 🖤', 'Ánh mắt sắc sảo quấn quýt~', 'Cọ đầu đánh dấu lãnh thổ~'],
    vibeNote: 'Bé này rất quấn chủ và trung thành, lúc nào cũng thích theo sát để canh giữ góc nhỏ.',
  },
  {
    id: 'pet_on_nhu',
    tag: 'Ôn nhu',
    keywords: ['ôn nhu', 'điềm đạm', 'nhã nhặn', 'chín chắn', 'bao dung'],
    speciesList: ['Cún Golden Nhỏ', 'Thỏ Trắng Tuyết'],
    personality: 'bao dung, ấm áp, luôn nhẹ nhàng bước lại gần mỗi khi cần vỗ về',
    behaviorStyle: 'gentle_sway',
    sounds: ['Gâu trầm ấm áp~ 🤍', 'Đặt chân nhỏ lên tay bạn~', 'Dụi đầu hiền hậu~'],
    vibeNote: 'Bé này có tính cách ôn nhu và tình cảm, luôn kiên nhẫn bầu bạn thật dịu dàng.',
  },
  {
    id: 'pet_ngao_kieu',
    tag: 'Ngạo kiều',
    keywords: ['ngạo kiều', 'kiêu kỳ', 'sang chảnh', 'quý phái', 'cao ngạo'],
    speciesList: ['Mèo Ba Tư Lông Xù', 'Khổng Tước Nhỏ'],
    personality: 'bước đi kiêu hãnh, thích nằm trên đệm nhung êm ái nhất phòng',
    behaviorStyle: 'calm_slow',
    sounds: ['Meo~ quý phái 👑', 'Ngẩng cao đầu kiêu hãnh~', 'Khẽ phe phẩy chiếc đuôi xù~'],
    vibeNote: 'Bé này có dáng điệu kiêu sa tao nhã, nhưng khi quen thân lại rất thích được chiều chuộng.',
  },
  {
    id: 'pet_thong_thai',
    tag: 'Thông thái',
    keywords: ['thông thái', 'uyên bác', 'quân sư', 'cố vấn', 'trí tuệ', 'minh triết'],
    speciesList: ['Cú Mèo Lông Vàng', 'Quạ Trắng Thông Thái'],
    personality: 'minh mẫn, điềm tĩnh, hay nghiêng đầu lắng nghe như thấu hiểu mọi điều',
    behaviorStyle: 'calm_slow',
    sounds: ['Hù~ trầm ngâm 🦉', 'Gật đầu thấu hiểu~', 'Vỗ cánh điềm tĩnh~'],
    vibeNote: 'Bé này có đôi mắt sáng thông thái, thích đậu yên lắng nghe những cuộc trò chuyện sâu sắc.',
  },
  {
    id: 'pet_tinh_nghich',
    tag: 'Tinh nghịch',
    keywords: ['tinh nghịch', 'lém lỉnh', 'nghịch ngợm', 'nhí nhảnh', 'trêu chọc'],
    speciesList: ['Cáo Đỏ Lém Lỉnh', 'Chồn Nhỏ Đuôi Bông'],
    personality: 'nhanh nhẹn, hay lăn tròn và bày trò đùa vui khắp thảm cỏ',
    behaviorStyle: 'playful_bouncy',
    sounds: ['Chít chít tinh ranh~ 🦊', 'Nhảy bật lên vui nhộn~', 'Lăn tròn trên thảm~'],
    vibeNote: 'Bé này tính tình hoạt bát tinh nghịch, lúc nào cũng bày trò đáng yêu khắp phòng.',
  },
  {
    id: 'pet_am_ap',
    tag: 'Ấm áp',
    keywords: ['ấm áp', 'nắng ấm', 'chân thành', 'tình nghĩa', 'sưởi ấm'],
    speciesList: ['Cún Shiba Má Phính', 'Gấu Bông Nhỏ Mật Ong'],
    personality: 'nồng hậu, bộ lông mềm ấm như nắng sớm mùa thu',
    behaviorStyle: 'gentle_sway',
    sounds: ['Gâu! Cười tít mắt~ ☀️', 'Ôm lấy chân ấm sực~', 'Vẫy đuôi rạng rỡ~'],
    vibeNote: 'Bé này mang nguồn năng lượng ấm áp như nắng sớm, ở cạnh là thấy lòng vui vẻ ngay.',
  },
  {
    id: 'pet_noi_tam',
    tag: 'Nội tâm',
    keywords: ['nội tâm', 'sâu sắc', 'nhạy cảm', 'suy tư', 'khép kín', 'hướng nội'],
    speciesList: ['Hươu Sao Nhỏ', 'Nhím Bông Hoa Hồng'],
    personality: 'hơi nhút nhát lúc mới quen nhưng khi thân thiết lại vô cùng gắn bó',
    behaviorStyle: 'calm_slow',
    sounds: ['Chít nhỏ dịu dàng~ 🎐', 'Khẽ bước lại gần làm quen~', 'Nép bên cạnh thật ngoan~'],
    vibeNote: 'Bé này tính tình tinh tế và dịu nhẹ, hợp với những tâm hồn sâu sắc yêu sự yên bình.',
  },
  {
    id: 'pet_tien_hiep',
    tag: 'Tiên hiệp',
    keywords: ['tiên hiệp', 'tu tiên', 'huyền huyễn', 'kiếm tiên', 'sư tôn', 'đạo hữu'],
    speciesList: ['Hồ Ly Chín Đuôi Mini', 'Linh Hạc Sương Mai'],
    personality: 'linh động, thanh khiết, mang khí chất tiên cảnh mây ngàn',
    behaviorStyle: 'mystic_float',
    sounds: ['Tiếng ngân thanh thoát~ 🪷', 'Lướt nhẹ trên mây~', 'Khẽ vẫy chín chiếc đuôi bông~'],
    vibeNote: 'Bé này có linh khí thanh tao thoát tục, rất hợp với phong vị cổ tích tiên hiệp.',
  },
  {
    id: 'pet_quy_toc',
    tag: 'Quý tộc',
    keywords: ['quý tộc', 'hoàng gia', 'lịch lãm', 'trang nhã', 'công tước', 'thanh lịch'],
    speciesList: ['Mèo Trắng Đeo Nơ', 'Thiên Nga Vương Miện Nhỏ'],
    personality: 'lịch thiệp, bước đi nhịp nhàng chuẩn mực như trong dinh thự cổ',
    behaviorStyle: 'gentle_sway',
    sounds: ['Meo~ thanh lịch 🫖', 'Khẽ cúi chào duyên dáng~', 'Bước đi êm ái quý phái~'],
    vibeNote: 'Bé này có phong thái lịch thiệp và tao nhã, tô điểm nét sang trọng dịu dàng cho căn phòng.',
  },
  {
    id: 'pet_tho_mong',
    tag: 'Thơ mộng',
    keywords: ['thơ mộng', 'mộng mơ', 'bay bổng', 'thi ca', 'lãng đãng', 'mây hồng'],
    speciesList: ['Thỏ Mây Hồng', 'Bướm Đêm Ánh Ngân'],
    personality: 'mơ màng, nhẹ nhàng như đám mây nhỏ trôi dưới ánh hoàng hôn',
    behaviorStyle: 'gentle_sway',
    sounds: ['Khẽ nghiêng tai mơ màng~ 🌷', 'Vỗ cánh êm như thơ~', 'Lim dim ngắm mây~'],
    vibeNote: 'Bé này mang vẻ đẹp mơ màng bay bổng, rất hợp với bầu không khí thơ mộng nơi đây.',
  },
  {
    id: 'pet_cool_ngau',
    tag: 'Cool ngầu',
    keywords: ['cool ngầu', 'cá tính', 'bụi bặm', 'ngầu', 'tự do', 'phong trần'],
    speciesList: ['Ưng Nhỏ Ánh Thép', 'Chó Husky Đeo Khăn'],
    personality: 'phong độ, lanh lợi, dáng đứng vững chãi đầy cá tính',
    behaviorStyle: 'energetic_dash',
    sounds: ['Gâu! Phong độ 😎', 'Vỗ cánh mạnh mẽ~', 'Ngẩng đầu cực ngầu~'],
    vibeNote: 'Bé này có phong thái tự tin và cá tính mạnh mẽ, trông cực kỳ ấn tượng khi dạo bước trong phòng.',
  },
  {
    id: 'pet_hoc_duong',
    tag: 'Học đường',
    keywords: ['học đường', 'thanh mai trúc mã', 'bạn cùng bàn', 'đàn anh', 'trường học'],
    speciesList: ['Cún Poodle Đeo Cặp Nhỏ', 'Mèo Tam Thể Sân Trường'],
    personality: 'hồn nhiên, chăm chỉ, thích nằm ngoan dưới gầm bàn học',
    behaviorStyle: 'playful_bouncy',
    sounds: ['Gâu nhỏ chăm ngoan~ 🎒', 'Meo~ đòi xoa đầu giờ ra chơi~', 'Lon ton chạy theo~'],
    vibeNote: 'Bé này mang nét hồn nhiên trong trẻo, gợi nhớ những buổi chiều nắng ấm đầy kỷ niệm.',
  },
  {
    id: 'pet_tong_tai',
    tag: 'Tổng tài',
    keywords: ['tổng tài', 'chủ tịch', 'doanh nhân', 'giám đốc', 'quyền lực'],
    speciesList: ['Mèo Đen Cổ Thắt Nơ', 'Sư Tử Bông Mini'],
    personality: 'điềm đạm, uy nghi nhưng rất thích nằm gần người mình tin cậy',
    behaviorStyle: 'calm_slow',
    sounds: ['Gừm trầm uy nghi~ 💼', 'Bước đi chững chạc~', 'Khẽ ngoắc đuôi hài lòng~'],
    vibeNote: 'Bé này có phong thái chững chạc và điềm tĩnh, tạo cảm giác vô cùng vững chãi và ấm áp.',
  },
  {
    id: 'pet_trinh_tham',
    tag: 'Trinh thám',
    keywords: ['trinh thám', 'thám tử', 'suy luận', 'quan sát', 'nhạy bén', 'bí mật'],
    speciesList: ['Cún Beagle Đánh Hơi', 'Quạ Nhỏ Tinh Anh'],
    personality: 'nhạy bén, tò mò, đôi mắt luôn quan sát tinh tường mọi ngóc ngách',
    behaviorStyle: 'energetic_dash',
    sounds: ['Khịt khịt tìm manh mối~ 🔍', 'Gâu! Phát hiện điều thú vị~', 'Nghiêng đầu suy luận~'],
    vibeNote: 'Bé này rất lanh lợi và tinh ý, thích khám phá từng góc nhỏ thú vị trong căn phòng.',
  },
  {
    id: 'pet_thanh_xuan',
    tag: 'Thanh xuân',
    keywords: ['thanh xuân', 'tuổi trẻ', 'mùa hạ', 'trong trẻo', 'ước mơ', 'nắng sớm'],
    speciesList: ['Chim Én Mùa Hạ', 'Sóc Nhỏ Nắng Mai'],
    personality: 'tươi sáng, ríu rít, mang theo hơi thở trong lành của gió đầu mùa',
    behaviorStyle: 'playful_bouncy',
    sounds: ['Líu lo nắng mới~ 🌻', 'Nhảy nhót rạng rỡ~', 'Vẫy đuôi chào ngày mới~'],
    vibeNote: 'Bé này tràn đầy sức sống tươi trẻ, làm không gian quanh phòng luôn rạng rỡ như nắng mùa hạ.',
  },
];

// ============================================================================
// HỆ THỐNG XƯNG HÔ (`resolveAddress`) & BẢNG TỪ KHÓA `address_map`
// ============================================================================

export interface AddressKeywordRule {
  id: string;
  keywords: string[]; // Các từ khóa trong danh xưng (epithet) hoặc tag
  self: string; // xưng (vd: "anh", "em", "tôi", "ta", "mình"...)
  user: string; // gọi (vd: "em", "anh", "bạn", "cậu", "bé"...)
  note?: string;
}

export interface ResolvedAddressPair {
  self: string; // xưng
  user: string; // gọi
  pairLabel: string; // vd: "anh - em"
  source: 'address_terms' | 'open_scene' | 'epithet_tags' | 'default';
  matchedDetail?: string;
}

export const SUGGESTED_ADDRESS_CHIPS: string[] = [
  'anh - em',
  'anh - bé',
  'anh - vợ',
  'em - anh',
  'chị - em',
  'cậu - tớ',
  'mình - cậu',
  'tôi - em',
];

export const DEFAULT_ADDRESS_MAP: AddressKeywordRule[] = [
  {
    id: 'addr_anh_vo',
    keywords: ['chồng', 'ông xã', 'hôn phu', 'phu quân', 'cưới', 'tân lang'],
    self: 'anh',
    user: 'vợ',
    note: 'Chồng / Hôn phu ấm áp',
  },
  {
    id: 'addr_anh_be',
    keywords: ['sủng', 'chiều chuộng', 'chú nhỏ', 'anh nuôi', 'bảo bọc', 'cưng chiều'],
    self: 'anh',
    user: 'bé',
    note: 'Chiều chuộng / Ngọt sủng',
  },
  {
    id: 'addr_anh_em',
    keywords: [
      'anh hàng xóm',
      'đàn anh',
      'học trưởng',
      'tiền bối',
      'bạn trai',
      'anh trai',
      'tổng tài',
      'giám đốc',
      'chủ tịch',
      'bác sĩ',
      'thầy',
      'thiếu gia',
      'ca sĩ',
      'nhiếp ảnh',
      'ôn nhu',
    ],
    self: 'anh',
    user: 'em',
    note: 'Nam chín chắn / Đàn anh / Hàng xóm',
  },
  {
    id: 'addr_toi_em',
    keywords: [
      'chiếm hữu',
      'bá đạo',
      'lạnh lùng',
      'mafia',
      'sát thủ',
      'nguy hiểm',
      'trưởng phòng',
      'cấp trên',
      'quản gia',
      'vệ sĩ',
    ],
    self: 'tôi',
    user: 'em',
    note: 'Lạnh lùng / Chiếm hữu / Khoảng cách quyến rũ',
  },
  {
    id: 'addr_chi_em',
    keywords: [
      'chị gái',
      'đàn chị',
      'học tỷ',
      'cô giáo',
      'nữ hoàng',
      'phú bà',
      'chị đẹp',
      'chị hàng xóm',
      'ự tỷ',
    ],
    self: 'chị',
    user: 'em',
    note: 'Đàn chị / Cô giáo / Chị đẹp',
  },
  {
    id: 'addr_em_anh',
    keywords: [
      'em gái',
      'bạn gái',
      'vợ nhỏ',
      'cô dâu',
      'học muội',
      'đàn em',
      'học đệ',
      'em trai',
      'niên hạ',
      'cún nhỏ',
      'làm nũng',
    ],
    self: 'em',
    user: 'anh',
    note: 'Em nhỏ / Niên hạ / Bạn gái',
  },
  {
    id: 'addr_to_cau',
    keywords: [
      'bạn cùng bàn',
      'thanh mai trúc mã',
      'học đường',
      'bạn học',
      'lớp trưởng',
      'bạn thân',
      'tinh nghịch',
      'thanh xuân',
    ],
    self: 'tớ',
    user: 'cậu',
    note: 'Bạn học / Thanh mai trúc mã',
  },
  {
    id: 'addr_cau_to',
    keywords: ['cậu bạn', 'đồng bàn', 'nhút nhát'],
    self: 'cậu',
    user: 'tớ',
    note: 'Gần gũi học đường',
  },
  {
    id: 'addr_minh_cau',
    keywords: ['đời thường', 'hàng xóm', 'gần gũi', 'tri kỷ', 'bình dị', 'nội tâm', 'thơ mộng'],
    self: 'mình',
    user: 'cậu',
    note: 'Đời thường / Tri kỷ nhẹ nhàng',
  },
  {
    id: 'addr_ta_nang',
    keywords: ['vương gia', 'hoàng đế', 'tướng quân', 'thái tử', 'công tử', 'cổ trang'],
    self: 'ta',
    user: 'nàng',
    note: 'Cổ trang / Vương gia - Nàng',
  },
  {
    id: 'addr_ta_nguoi',
    keywords: ['tiên hiệp', 'kiếm tiên', 'sư tôn', 'thần tiên', 'kỳ ảo', 'quý tộc', 'thông thái'],
    self: 'ta',
    user: 'người',
    note: 'Tiên hiệp / Kỳ ảo / Quý tộc',
  },
  {
    id: 'addr_ta_nguoi_ngao',
    keywords: ['ngạo kiều', 'ma tôn', 'bá vương', 'ác ma'],
    self: 'ta',
    user: 'ngươi',
    note: 'Ngạo kiều / Ma tôn',
  },
];

/**
 * 36+ mẫu từ khóa quét Open Scene (chỉ quét trong bộ nhớ RAM khi người dùng có quyền xem Open Scene)
 */
interface OpenSceneAddressPattern {
  id: string;
  regex: RegExp;
  self: string;
  user: string;
  weight: number;
}

const OPEN_SCENE_ADDRESS_PATTERNS: OpenSceneAddressPattern[] = [
  // 1-10: Xưng "anh" với các cách gọi thân mật / đặc trưng
  { id: 'os_anh_voyeu', regex: /\b(anh)\b[^.!?\n]{0,45}\b(vợ yêu)\b|\b(vợ yêu)\b[^.!?\n]{0,45}\b(anh)\b/i, self: 'anh', user: 'vợ yêu', weight: 100 },
  { id: 'os_anh_baxa', regex: /\b(anh)\b[^.!?\n]{0,45}\b(bà xã)\b|\b(bà xã)\b[^.!?\n]{0,45}\b(anh)\b/i, self: 'anh', user: 'bà xã', weight: 98 },
  { id: 'os_anh_vo', regex: /\b(anh)\b[^.!?\n]{0,40}\b(vợ)\b|\b(vợ)\s+(ơi|à|nhé|ngoan|của anh)\b/i, self: 'anh', user: 'vợ', weight: 95 },
  { id: 'os_anh_cuccung', regex: /\b(anh)\b[^.!?\n]{0,40}\b(cục cưng)\b|\b(cục cưng)\s+(của anh|ơi|à)\b/i, self: 'anh', user: 'cục cưng', weight: 94 },
  { id: 'os_anh_becung', regex: /\b(anh)\b[^.!?\n]{0,40}\b(bé cưng)\b|\b(bé cưng)\s+(của anh|ơi|à|ngoan)\b/i, self: 'anh', user: 'bé cưng', weight: 93 },
  { id: 'os_anh_becon', regex: /\b(anh)\b[^.!?\n]{0,40}\b(bé con|bé nhỏ)\b|\b(bé con|bé nhỏ)\s+(của anh|ơi|à|ngoan)\b/i, self: 'anh', user: 'bé con', weight: 92 },
  { id: 'os_anh_baoboi', regex: /\b(anh)\b[^.!?\n]{0,40}\b(bảo bối)\b|\b(bảo bối)\s+(của anh|ơi|à)\b/i, self: 'anh', user: 'bảo bối', weight: 91 },
  { id: 'os_anh_be', regex: /\b(anh)\b[^.!?\n]{0,35}\b(bé)\b|\b(bé)\s+(ơi|à|ngoan|của anh|ngốc)\b/i, self: 'anh', user: 'bé', weight: 90 },
  { id: 'os_anh_congchua', regex: /\b(anh)\b[^.!?\n]{0,45}\b(công chúa)\b|\b(công chúa nhỏ)\b/i, self: 'anh', user: 'công chúa', weight: 88 },
  { id: 'os_anh_nhoc', regex: /\b(anh)\b[^.!?\n]{0,40}\b(nhóc|nhóc con)\b|\b(nhóc)\s+(ơi|con|ngốc)\b/i, self: 'anh', user: 'nhóc', weight: 86 },
  { id: 'os_anh_cobe', regex: /\b(anh)\b[^.!?\n]{0,40}\b(cô bé)\b/i, self: 'anh', user: 'cô bé', weight: 85 },
  { id: 'os_anh_emyêu', regex: /\b(anh)\b[^.!?\n]{0,40}\b(em yêu|cưng)\b/i, self: 'anh', user: 'em yêu', weight: 84 },
  { id: 'os_anh_em', regex: /\b(anh)\b[^.!?\n]{0,45}\b(em)\b|\b(em)\b[^.!?\n]{0,45}\b(anh)\b/i, self: 'anh', user: 'em', weight: 80 },

  // 14-20: Xưng "em" với người chơi
  { id: 'os_em_chong', regex: /\b(em)\b[^.!?\n]{0,40}\b(chồng|ông xã)\b/i, self: 'em', user: 'chồng', weight: 95 },
  { id: 'os_em_chunhan', regex: /\b(em)\b[^.!?\n]{0,45}\b(chủ nhân|cậu chủ|thiếu gia)\b/i, self: 'em', user: 'chủ nhân', weight: 92 },
  { id: 'os_em_dananh', regex: /\b(em)\b[^.!?\n]{0,40}\b(đàn anh|học trưởng|tiền bối)\b/i, self: 'em', user: 'đàn anh', weight: 89 },
  { id: 'os_em_chi', regex: /\b(em)\b[^.!?\n]{0,35}\b(chị)\b|\b(chị)\s+(ơi|à)\b[^.!?\n]{0,35}\b(em)\b/i, self: 'em', user: 'chị', weight: 85 },
  { id: 'os_em_anh_direct', regex: /[“"«][^”"»]{0,80}\b(em)\s+(nhớ|thích|yêu|đợi|chờ|pha|nấu|mang|muốn)\s+(anh)\b/i, self: 'em', user: 'anh', weight: 86 },

  // 19-21: Xưng "chị" với người chơi
  { id: 'os_chi_be', regex: /\b(chị)\b[^.!?\n]{0,40}\b(bé|cưng|nhóc)\b/i, self: 'chị', user: 'bé', weight: 90 },
  { id: 'os_chi_em', regex: /\b(chị)\b[^.!?\n]{0,40}\b(em)\b/i, self: 'chị', user: 'em', weight: 83 },

  // 21-26: Xưng "tôi" với người chơi
  { id: 'os_toi_em', regex: /\b(tôi)\b[^.!?\n]{0,45}\b(em)\b|\b(em)\b[^.!?\n]{0,45}\b(tôi)\b/i, self: 'tôi', user: 'em', weight: 88 },
  { id: 'os_toi_tieuthu', regex: /\b(tôi)\b[^.!?\n]{0,45}\b(tiểu thư|cô chủ)\b/i, self: 'tôi', user: 'tiểu thư', weight: 90 },
  { id: 'os_toi_co', regex: /\b(tôi)\b[^.!?\n]{0,40}\b(cô)\b/i, self: 'tôi', user: 'cô', weight: 78 },
  { id: 'os_toi_anh', regex: /\b(tôi)\b[^.!?\n]{0,40}\b(anh)\b/i, self: 'tôi', user: 'anh', weight: 78 },
  { id: 'os_toi_bannho', regex: /\b(tôi)\b[^.!?\n]{0,45}\b(bạn nhỏ)\b/i, self: 'tôi', user: 'bạn nhỏ', weight: 87 },
  { id: 'os_toi_cau', regex: /\b(tôi)\b[^.!?\n]{0,45}\b(cậu)\b|\b(cậu)\b[^.!?\n]{0,45}\b(tôi)\b/i, self: 'tôi', user: 'cậu', weight: 82 },
  { id: 'os_toi_ban', regex: /\b(tôi)\b[^.!?\n]{0,45}\b(bạn)\b/i, self: 'tôi', user: 'bạn', weight: 72 },

  // 28-36: Cổ trang / Tiên hiệp / Kỳ ảo ("ta", "bổn tọa", "vi sư", "thần"...)
  { id: 'os_bontoa_nguoi', regex: /\b(bổn tọa|bản tọa|bổn vương)\b[^.!?\n]{0,50}\b(ngươi|nàng)\b/i, self: 'bổn tọa', user: 'ngươi', weight: 95 },
  { id: 'os_visu_doni', regex: /\b(vi sư|sư tôn)\b[^.!?\n]{0,50}\b(đồ nhi|đồ đệ|con)\b/i, self: 'vi sư', user: 'đồ nhi', weight: 95 },
  { id: 'os_ta_aiphi', regex: /\b(ta|trẫm|bổn vương)\b[^.!?\n]{0,50}\b(ái phi|vương phi|phu nhân)\b/i, self: 'ta', user: 'ái phi', weight: 94 },
  { id: 'os_ta_dode', regex: /\b(ta)\b[^.!?\n]{0,45}\b(đồ đệ|tiểu đồ đệ)\b/i, self: 'ta', user: 'đồ đệ', weight: 91 },
  { id: 'os_ta_daohuu', regex: /\b(ta)\b[^.!?\n]{0,45}\b(đạo hữu)\b/i, self: 'ta', user: 'đạo hữu', weight: 90 },
  { id: 'os_ta_nang', regex: /\b(ta)\b[^.!?\n]{0,45}\b(nàng)\b|\b(nàng)\b[^.!?\n]{0,45}\b(ta)\b/i, self: 'ta', user: 'nàng', weight: 89 },
  { id: 'os_ta_chang', regex: /\b(ta|thiếp)\b[^.!?\n]{0,45}\b(chàng)\b/i, self: 'ta', user: 'chàng', weight: 89 },
  { id: 'os_ta_nguoi_ancient', regex: /\b(ta)\b[^.!?\n]{0,45}\b(ngươi)\b|\b(ngươi)\b[^.!?\n]{0,45}\b(ta)\b/i, self: 'ta', user: 'ngươi', weight: 85 },
  { id: 'os_ta_nguoi_noble', regex: /\b(ta)\b[^.!?\n]{0,45}\b(người)\b/i, self: 'ta', user: 'người', weight: 78 },
  { id: 'os_than_dienha', regex: /\b(thần|thuộc hạ)\b[^.!?\n]{0,45}\b(điện hạ|bệ hạ|chủ nhân)\b/i, self: 'thần', user: 'điện hạ', weight: 92 },

  // 38-41: Học đường / Đời thường ("tớ - cậu", "cậu - tớ", "mình - cậu")
  { id: 'os_to_dangay', regex: /\b(tớ)\b[^.!?\n]{0,45}\b(đằng ấy)\b/i, self: 'tớ', user: 'đằng ấy', weight: 88 },
  { id: 'os_to_cau', regex: /\b(tớ)\b[^.!?\n]{0,45}\b(cậu)\b|\b(cậu)\b[^.!?\n]{0,45}\b(tớ)\b/i, self: 'tớ', user: 'cậu', weight: 84 },
  { id: 'os_minh_cau', regex: /\b(mình)\b[^.!?\n]{0,45}\b(cậu)\b|\b(cậu)\b[^.!?\n]{0,45}\b(mình)\b/i, self: 'mình', user: 'cậu', weight: 82 },
  { id: 'os_minh_ban', regex: /\b(mình)\b[^.!?\n]{0,45}\b(bạn)\b/i, self: 'mình', user: 'bạn', weight: 70 },
];

export function parseAddressTermsString(
  raw: string | undefined | null
): { self: string; user: string } | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;

  const parts = cleaned
    .split(/\s*(?:[-–—/→,~]|va|và)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2 && parts[0] && parts[1]) {
    return {
      self: parts[0].toLowerCase(),
      user: parts[1].toLowerCase(),
    };
  }
  return null;
}

/**
 * Hàm `resolveAddress(char, options)` trả về cặp (xưng, gọi) theo thứ tự ưu tiên:
 * a. `address_terms` (`addressTerms`) do Chủ web đặt (nếu có).
 * b. Đọc từ Open scene (CHỈ khi open scene đã được tải hợp lệ vào bộ nhớ RAM - tuyệt đối không lưu localStorage).
 * c. Đọc từ danh xưng (`epithet`) và `tags` theo bảng từ khóa `address_map`.
 * d. Mặc định: "mình - bạn".
 */
export function resolveAddress(
  char: {
    name?: string;
    addressTerms?: string | null;
    epithet?: string | null;
    tags?: string[] | null;
  } | null | undefined,
  options?: {
    inMemoryOpenScene?: string | null;
    addressMap?: AddressKeywordRule[];
  }
): ResolvedAddressPair {
  if (!char) {
    return {
      self: 'mình',
      user: 'bạn',
      pairLabel: 'mình - bạn',
      source: 'default',
    };
  }

  // (a) Ưu tiên 1: address_terms do Chủ web đặt
  const explicit = parseAddressTermsString(char.addressTerms);
  if (explicit) {
    return {
      self: explicit.self,
      user: explicit.user,
      pairLabel: `${explicit.self} - ${explicit.user}`,
      source: 'address_terms',
      matchedDetail: char.addressTerms?.trim() || '',
    };
  }

  // (b) Ưu tiên 2: Quét từ Open Scene (chỉ trong RAM khi đã tải hợp lệ)
  const openSceneText = (options?.inMemoryOpenScene || '').trim();
  if (openSceneText.length > 0) {
    let bestMatch: OpenSceneAddressPattern | null = null;
    for (const pat of OPEN_SCENE_ADDRESS_PATTERNS) {
      if (pat.regex.test(openSceneText)) {
        if (!bestMatch || pat.weight > bestMatch.weight) {
          bestMatch = pat;
        }
      }
    }
    if (bestMatch) {
      return {
        self: bestMatch.self,
        user: bestMatch.user,
        pairLabel: `${bestMatch.self} - ${bestMatch.user}`,
        source: 'open_scene',
        matchedDetail: `Open Scene (${bestMatch.self} - ${bestMatch.user})`,
      };
    }
  }

  // (c) Ưu tiên 3: Đọc từ danh xưng (epithet) và tags theo bảng address_map
  const rules =
    Array.isArray(options?.addressMap) && options!.addressMap.length > 0
      ? options!.addressMap
      : DEFAULT_ADDRESS_MAP;

  const epithetText = (char.epithet || '').trim().toLowerCase();
  const tagTexts = (char.tags || []).map((t) => (t || '').trim().toLowerCase()).filter(Boolean);

  // Quét danh xưng (epithet) trước vì danh xưng thường chỉ rõ vai vế ("Anh hàng xóm", "Cô giáo", "Bạn cùng bàn"...)
  if (epithetText) {
    for (const rule of rules) {
      for (const kw of rule.keywords) {
        const nkw = kw.trim().toLowerCase();
        if (nkw && epithetText.includes(nkw)) {
          return {
            self: rule.self.trim().toLowerCase(),
            user: rule.user.trim().toLowerCase(),
            pairLabel: `${rule.self.trim().toLowerCase()} - ${rule.user.trim().toLowerCase()}`,
            source: 'epithet_tags',
            matchedDetail: `Danh xưng: "${char.epithet}" (${nkw})`,
          };
        }
      }
    }
  }

  // Tiếp theo quét trong danh sách tags
  if (tagTexts.length > 0) {
    for (const rule of rules) {
      for (const kw of rule.keywords) {
        const nkw = kw.trim().toLowerCase();
        if (
          nkw &&
          tagTexts.some((t) => t === nkw || t.includes(nkw) || nkw.includes(t))
        ) {
          return {
            self: rule.self.trim().toLowerCase(),
            user: rule.user.trim().toLowerCase(),
            pairLabel: `${rule.self.trim().toLowerCase()} - ${rule.user.trim().toLowerCase()}`,
            source: 'epithet_tags',
            matchedDetail: `Tag: "${kw}"`,
          };
        }
      }
    }
  }

  // (d) Mặc định: "mình - bạn"
  return {
    self: 'mình',
    user: 'bạn',
    pairLabel: 'mình - bạn',
    source: 'default',
  };
}

function capitalizeFirst(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Thay thế {xưng}, {gọi} và đồng bộ các đại từ mặc định trong câu thoại sang cặp (xưng, gọi) của char.
 * Đảm bảo char KHÔNG tự xưng bằng tên riêng.
 */
export function applyAddressPairToDialogue(
  rawLine: string,
  pair: ResolvedAddressPair,
  charName?: string
): string {
  if (!rawLine) return '';
  const selfLower = pair.self || 'mình';
  const userLower = pair.user || 'bạn';
  const selfCap = capitalizeFirst(selfLower);
  const userCap = capitalizeFirst(userLower);

  let text = rawLine;

  // 1. Nếu có placeholder {xưng} / {gọi} trực tiếp
  text = text
    .replace(/\{Xưng\}/g, selfCap)
    .replace(/\{xưng\}/g, selfLower)
    .replace(/\{Gọi\}/g, userCap)
    .replace(/\{gọi\}/g, userLower);

  // 2. Loại bỏ trường hợp tự xưng bằng tên riêng của char (nếu có)
  if (charName && charName.trim().length > 1) {
    const escapedName = charName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\b${escapedName}\\b`, 'gi'), selfLower);
  }

  // 3. Chuyển đổi các đại từ mẫu trong kho câu thoại sang {xưng} và {gọi} bằng token trung gian để không chồng chéo
  const SELF_TOKEN_CAP = '__SELF_CAP__';
  const SELF_TOKEN_LOW = '__SELF_LOW__';
  const USER_TOKEN_CAP = '__USER_CAP__';
  const USER_TOKEN_LOW = '__USER_LOW__';

  // Các cụm dài thay trước
  text = text
    .replace(/\bbạn cùng bàn của tớ\b/gi, `${USER_TOKEN_LOW} của ${SELF_TOKEN_LOW}`)
    .replace(/\bngười bạn đồng hành của tôi\b/gi, `${USER_TOKEN_LOW} của ${SELF_TOKEN_LOW}`)
    .replace(/\bngười lữ hành\b/gi, USER_TOKEN_LOW)
    .replace(/\bbạn nhỏ của tôi\b/gi, `${USER_TOKEN_LOW} của ${SELF_TOKEN_LOW}`)
    .replace(/\bbạn nhỏ\b/gi, USER_TOKEN_LOW)
    .replace(/\bbạn hiền\b/gi, USER_TOKEN_LOW)
    .replace(/\bđằng ấy\b/gi, USER_TOKEN_LOW)
    .replace(/\bđạo hữu\b/gi, USER_TOKEN_LOW)
    .replace(/\bbổn tọa\b/gi, SELF_TOKEN_LOW)
    .replace(/\bbản tọa\b/gi, SELF_TOKEN_LOW)
    .replace(/\btụi mình\b/gi, `hai ${SELF_TOKEN_LOW} ${USER_TOKEN_LOW}`)
    .replace(/\bchúng mình\b/gi, `hai ${SELF_TOKEN_LOW} ${USER_TOKEN_LOW}`);

  // Đại từ xưng mẫu: mình, tôi, tớ, ta (chỉ khi đứng độc lập dạng đại từ)
  text = text
    .replace(/(^|[.!?…]\s+|“[ ]*)(Mình|Tôi|Tớ|Ta)\b/g, `$1${SELF_TOKEN_CAP}`)
    .replace(/\b(mình|tôi|tớ)\b/g, SELF_TOKEN_LOW)
    .replace(/\b(ta)\b(?!\s+(?:nhiều|ít|lớn))/g, SELF_TOKEN_LOW);

  // Đại từ gọi mẫu: bạn, cậu, ngươi, người (khi mang nghĩa ngôi thứ 2)
  text = text
    .replace(/(^|[.!?…]\s+|“[ ]*)(Bạn|Cậu|Ngươi|Người)\b/g, `$1${USER_TOKEN_CAP}`)
    .replace(/\b(bạn|cậu|ngươi)\b/g, USER_TOKEN_LOW)
    .replace(
      /\b(người)\b(?=\s+(?:vừa|đến|tới|ghé|có|hãy|đừng|nhớ|về|ngồi|cứ|là|đã|mang|tặng|thưởng|lại|đi|ngủ|bước|chính))/g,
      USER_TOKEN_LOW
    )
    .replace(
      /(?:của|với|cho|đợi|chờ|cùng|thăm|tặng|cảm ơn|cảm tạ|đa tạ|chào|tiễn|bên|cạnh|tay|lòng|mắt|gối)\s+\b(người)\b/g,
      (m) => m.replace(/\bngười\b$/, USER_TOKEN_LOW)
    );

  // Hoàn trả token thành từ xưng/gọi thực tế
  text = text
    .replace(new RegExp(SELF_TOKEN_CAP, 'g'), selfCap)
    .replace(new RegExp(SELF_TOKEN_LOW, 'g'), selfLower)
    .replace(new RegExp(USER_TOKEN_CAP, 'g'), userCap)
    .replace(new RegExp(USER_TOKEN_LOW, 'g'), userLower);

  // Đảm bảo chữ cái đầu câu luôn viết hoa đẹp
  text = text.replace(/^([“"']?\s*)([a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ])/, (_, p1, p2) => `${p1}${p2.toUpperCase()}`);

  return text;
}

/**
 * Rút trích chi tiết bầu không khí (vibe/motif) từ Open Scene đang có trong RAM
 * để dệt thêm vào câu thoại Phòng tri kỷ & Khu thú cưng (không lộ nguyên văn, không lưu localStorage).
 */
function extractOpenSceneAtmosphereHint(inMemoryOpenScene?: string | null): string | null {
  if (!inMemoryOpenScene || !inMemoryOpenScene.trim()) return null;
  const low = inMemoryOpenScene.toLowerCase();
  if (low.includes('mưa')) return 'tiếng mưa rơi ngoài hiên';
  if (low.includes('trà')) return 'hương trà ấm còn vương';
  if (low.includes('cà phê') || low.includes('coffee')) return 'hương cà phê thơm dịu';
  if (low.includes('trăng') || low.includes('nguyệt')) return 'ánh trăng dịu ngoài khung cửa';
  if (low.includes('sách') || low.includes('thư viện')) return 'những trang sách mở dở';
  if (low.includes('đàn') || low.includes('nhạc') || low.includes('piano')) return 'giai điệu êm đềm đang ngân';
  if (low.includes('hoa') || low.includes('vườn')) return 'hương hoa thoang thoảng trong gió';
  if (low.includes('nến') || low.includes('đèn vàng')) return 'ánh đèn ấm áp nơi góc phòng';
  if (low.includes('tuyết') || low.includes('đông')) return 'hơi ấm giữa ngày lạnh';
  if (low.includes('biển') || low.includes('sóng')) return 'tiếng gió dịu dàng';
  return 'bầu không khí quen thuộc của hai đứa';
}

// ============================================================================
// HÀM LÀM SẠCH GHI CHÚ THÚ CƯNG (ĐẢM BẢO TUYỆT ĐỐI KHÔNG CÓ TÊN CHAR)
// ============================================================================
export function sanitizePetVibeNote(
  rawNote: string | undefined,
  matchedTag?: string,
  species?: string,
  charNameToStrip?: string
): string {
  const cleanTag = (matchedTag || 'dịu dàng').toLowerCase();
  const cleanSpecies = (species || 'thú cưng').toLowerCase();

  if (!rawNote || !rawNote.trim()) {
    return `Bé ${cleanSpecies} có tính cách điềm đạm, đáng yêu, rất hợp với bầu không khí ${cleanTag} nơi đây.`;
  }

  let note = rawNote;

  // Nếu câu ghi chú cũ có dạng "Hợp với vibe "..." của [Tên Char]: ..." hoặc chứa chữ "của " trước dấu hai chấm
  if (/hợp với vibe .* của [^:]+:/i.test(note)) {
    const afterColon = note.split(':').slice(1).join(':').trim();
    if (afterColon) {
      note = `${afterColon.replace(/\s+/g, ' ').replace(/\.$/, '')}, rất hợp với bầu không khí ${cleanTag} nơi đây.`;
    } else {
      note = `Bé ${cleanSpecies} có tính cách đáng yêu, rất hợp với bầu không khí ${cleanTag} nơi đây.`;
    }
  }

  if (charNameToStrip && charNameToStrip.trim().length > 1) {
    const escaped = charNameToStrip.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    note = note.replace(new RegExp(`của\\s+${escaped}`, 'gi'), 'nơi đây');
    note = note.replace(new RegExp(escaped, 'gi'), 'góc nhỏ');
  }

  return note;
}

// ============================================================================
// NHẬN DIỆN GIỌNG THEO TAG (CHÍNH XÁC -> TỪ KHÓA -> TRUNG TÍNH DỊU)
// ============================================================================
function normalizeStr(s: string): string {
  return s.trim().toLowerCase();
}

export function resolveVoiceProfileForSingleTag(
  rawTag: string,
  customVoices: TagVoiceProfile[] = DEFAULT_TAG_VOICES
): TagVoiceProfile {
  const norm = normalizeStr(rawTag);
  const pool =
    Array.isArray(customVoices) && customVoices.length > 0
      ? customVoices
      : DEFAULT_TAG_VOICES;

  // 1. Khớp chính xác tên tag
  const exact = pool.find((v) => normalizeStr(v.tag) === norm);
  if (exact) return exact;

  // 2. Khớp theo từ khóa (keyword matching)
  const byKeyword = pool.find((v) =>
    v.keywords.some((kw) => {
      const nkw = normalizeStr(kw);
      return nkw && (norm.includes(nkw) || nkw.includes(norm));
    })
  );
  if (byKeyword) return byKeyword;

  // 3. Heuristic từ khóa mở rộng cho các tag tùy chỉnh lạ
  if (/dịu|hiền|êm|mềm|thương/.test(norm)) {
    return pool.find((v) => normalizeStr(v.tag) === 'dịu dàng') || NEUTRAL_GENTLE_VOICE;
  }
  if (/lạnh|băng|kiệm|ít nói|cool|ngầu|sát/.test(norm)) {
    return pool.find((v) => normalizeStr(v.tag) === 'lạnh lùng') || NEUTRAL_GENTLE_VOICE;
  }
  if (/hài|vui|cười|đùa|nhây|lầy|tấu/.test(norm)) {
    return pool.find((v) => normalizeStr(v.tag) === 'hài hước') || NEUTRAL_GENTLE_VOICE;
  }
  if (/chữa|lành|an ủi|tâm lý|bác sĩ|trà/.test(norm)) {
    return pool.find((v) => normalizeStr(v.tag) === 'chữa lành') || NEUTRAL_GENTLE_VOICE;
  }
  if (/bí ẩn|đêm|ma|bóng|mờ|tối|tarot/.test(norm)) {
    return pool.find((v) => normalizeStr(v.tag) === 'bí ẩn') || NEUTRAL_GENTLE_VOICE;
  }
  if (/tsun|đanh đá|cọc|dỗi|khẩu thị/.test(norm)) {
    return pool.find((v) => normalizeStr(v.tag) === 'tsundere') || NEUTRAL_GENTLE_VOICE;
  }
  if (/cổ|xưa|trúc|cung|vương|hán|kiếm/.test(norm)) {
    return pool.find((v) => normalizeStr(v.tag) === 'cổ trang') || NEUTRAL_GENTLE_VOICE;
  }
  if (/buồn|mưa|sầu|khóc|cô đơn|nhớ/.test(norm)) {
    return pool.find((v) => normalizeStr(v.tag) === 'u buồn') || NEUTRAL_GENTLE_VOICE;
  }
  if (/ngọt|kẹo|dễ thương|cute|cưng|sủng/.test(norm)) {
    return pool.find((v) => normalizeStr(v.tag) === 'ngọt ngào') || NEUTRAL_GENTLE_VOICE;
  }
  if (/sách|học|thầy|giáo|thư viện|tri thức/.test(norm)) {
    return pool.find((v) => normalizeStr(v.tag) === 'học giả') || NEUTRAL_GENTLE_VOICE;
  }

  // 4. Không đoán được -> dùng giọng trung tính dịu
  return NEUTRAL_GENTLE_VOICE;
}

/**
 * Lấy danh sách 2-3 giọng đầu tiên của nhân vật để trộn văn phong
 */
export function resolveBlendedVoicesForCharacter(
  charTags: string[],
  customVoices: TagVoiceProfile[] = DEFAULT_TAG_VOICES
): TagVoiceProfile[] {
  const topTags = (charTags || []).filter(Boolean).slice(0, 3);
  if (topTags.length === 0) {
    return [NEUTRAL_GENTLE_VOICE];
  }

  const resolved: TagVoiceProfile[] = [];
  const seenIds = new Set<string>();

  topTags.forEach((tag) => {
    const profile = resolveVoiceProfileForSingleTag(tag, customVoices);
    if (!seenIds.has(profile.id)) {
      seenIds.add(profile.id);
      resolved.push(profile);
    }
  });

  return resolved.length > 0 ? resolved : [NEUTRAL_GENTLE_VOICE];
}

/**
 * Sinh câu thoại trộn giọng từ 2-3 tag đầu của Char theo tình huống, điểm Gắn bó và cặp {xưng} - {gọi} từ `resolveAddress`:
 * - Mọi câu của char đều chèn đúng {xưng} và {gọi}.
 * - Kết hợp giọng theo tag + hơi thở của Open Scene (nếu đã mở trong RAM).
 * - Điểm thân mật càng cao thì lời càng gần gũi.
 */
export function generateCompanionDialogueByTags(params: {
  charTags: string[];
  situation: DialogueSituation;
  bondPoints: number;
  itemName?: string;
  customVoices?: TagVoiceProfile[];
  previousText?: string;
  addressPair?: ResolvedAddressPair;
  inMemoryOpenScene?: string | null;
  charName?: string;
}): {
  text: string;
  blendedTagsLabel: string;
  voiceSummary: string;
  addressPair: ResolvedAddressPair;
} {
  const {
    charTags,
    situation,
    bondPoints,
    itemName,
    customVoices = DEFAULT_TAG_VOICES,
    previousText,
    addressPair: providedPair,
    inMemoryOpenScene,
    charName,
  } = params;

  const activePair: ResolvedAddressPair =
    providedPair ||
    resolveAddress(
      { name: charName, tags: charTags },
      { inMemoryOpenScene }
    );

  const voices = resolveBlendedVoicesForCharacter(charTags, customVoices);
  const primaryVoice = voices[0] || NEUTRAL_GENTLE_VOICE;
  const secondaryVoice = voices[1];
  const tertiaryVoice = voices[2];

  const candidatePool: string[] = [];

  voices.forEach((v, idx) => {
    const sitLines = v.dialogues[situation] || [];
    const unlockedCount =
      bondPoints >= 70
        ? sitLines.length
        : bondPoints >= 30
        ? Math.max(2, sitLines.length)
        : Math.max(1, Math.ceil(sitLines.length * 0.65));

    const sliced = sitLines.slice(0, unlockedCount);
    sliced.forEach((line) => {
      candidatePool.push(line);
      if (idx === 0) candidatePool.push(line);
    });

    if ((situation === 'chat' && bondPoints >= 70) || situation === 'high_bond') {
      (v.dialogues.high_bond || []).forEach((hbLine) => {
        candidatePool.push(hbLine);
      });
    }
  });

  // Nếu Open Scene đã mở hợp lệ trong RAM, thêm các câu mang hơi thở Open Scene + {xưng}/{gọi}
  const openSceneHint = extractOpenSceneAtmosphereHint(inMemoryOpenScene);
  if (openSceneHint) {
    if (situation === 'greeting') {
      candidatePool.push(
        `{Gọi} tới rồi à, giữa ${openSceneHint} thế này mà có {gọi} bước vào là {xưng} thấy ấm lòng hẳn lên ${primaryVoice.emojis[0] || '✨'}`
      );
    } else if (situation === 'chat') {
      candidatePool.push(
        `Ngồi cạnh {gọi} lắng nghe ${openSceneHint}, {xưng} chỉ mong khoảnh khắc yên bình này kéo dài mãi thôi ${primaryVoice.emojis[0] || '🌸'}`
      );
      if (bondPoints >= 50) {
        candidatePool.push(
          `Từ khoảnh khắc đầu tiên gặp {gọi} giữa ${openSceneHint}, ánh mắt {xưng} đã luôn dõi theo {gọi} rồi ${primaryVoice.emojis[0] || '💗'}`
        );
      }
    } else if (situation === 'high_bond') {
      candidatePool.push(
        `Giữa ${openSceneHint}, điều quý giá nhất với {xưng} chính là được nắm tay {gọi} đi qua từng ngày êm đềm thế này ${primaryVoice.emojis[0] || '💗'}`
      );
    }
  }

  // Thêm câu thân mật theo mức bondPoints với {xưng} - {gọi}
  if (bondPoints >= 80 && (situation === 'chat' || situation === 'high_bond')) {
    candidatePool.push(
      `Ở bên {gọi} càng lâu, {xưng} càng nhận ra {gọi} là người đặc biệt nhất mà {xưng} luôn muốn chở che và lắng nghe mỗi ngày ${primaryVoice.emojis[0] || '💗'}`
    );
  }

  if (candidatePool.length === 0) {
    candidatePool.push(...NEUTRAL_GENTLE_VOICE.dialogues.chat);
  }

  // Biến đổi toàn bộ ứng viên theo {xưng} và {gọi}
  const transformedPool = candidatePool.map((raw) => {
    let line = raw;
    if (itemName) {
      line = line.replace(/\{item\}/g, itemName);
    } else {
      line = line.replace(/\{item\}/g, 'món quà nhỏ');
    }
    return applyAddressPairToDialogue(line, activePair, charName);
  });

  const nonRepeating = transformedPool.filter(
    (c) => !previousText || !previousText.includes(c.slice(0, 18))
  );
  const poolToPick = nonRepeating.length > 0 ? nonRepeating : transformedPool;
  let chosen = poolToPick[Math.floor(Math.random() * poolToPick.length)];

  if (secondaryVoice && bondPoints >= 30) {
    const secEmoji =
      secondaryVoice.emojis[
        Math.floor(Math.random() * secondaryVoice.emojis.length)
      ] || '';
    if (secEmoji && !chosen.includes(secEmoji)) {
      chosen = `${chosen} ${secEmoji}`;
    }
  }
  if (tertiaryVoice && bondPoints >= 70) {
    const terEmoji = tertiaryVoice.emojis[0] || '';
    if (terEmoji && !chosen.includes(terEmoji)) {
      chosen = `${chosen} ${terEmoji}`;
    }
  }

  const blendedTagsLabel = voices.map((v) => v.tag).join(' + ');
  const voiceSummary = `${primaryVoice.rhythm}${
    secondaryVoice ? ` · pha nét ${secondaryVoice.tag.toLowerCase()}` : ''
  } · xưng hô "${activePair.pairLabel}"`;

  return {
    text: `“${chosen.replace(/^[“"]|[”"]$/g, '').trim()}”`,
    blendedTagsLabel,
    voiceSummary,
    addressPair: activePair,
  };
}

/**
 * Sinh lời nhận xét của Char trong Khu thú cưng:
 * - Luôn dùng đúng {xưng} và {gọi} từ `resolveAddress` (TUYỆT ĐỐI không tự xưng bằng tên riêng của char).
 * - Kết hợp giọng theo tag (dịu dàng, lạnh lùng, hài hước, bí ẩn...) và hơi thở Open Scene (nếu đã mở trong RAM).
 * - Điểm thân mật càng cao thì lời càng gần gũi.
 */
export function generateCompanionPetComment(params: {
  char: {
    name?: string;
    addressTerms?: string | null;
    epithet?: string | null;
    tags?: string[] | null;
  } | null;
  petName: string;
  petSpecies?: string;
  petPersonality?: string;
  action: 'select' | 'pet' | 'feed' | 'play' | 'rest';
  bondPoints: number;
  inMemoryOpenScene?: string | null;
  addressMap?: AddressKeywordRule[];
  customVoices?: TagVoiceProfile[];
}): {
  text: string;
  addressPair: ResolvedAddressPair;
} {
  const {
    char,
    petName,
    petSpecies = 'thú nhỏ',
    action,
    bondPoints,
    inMemoryOpenScene,
    addressMap,
    customVoices = DEFAULT_TAG_VOICES,
  } = params;

  const pair = resolveAddress(char, { inMemoryOpenScene, addressMap });
  const voices = resolveBlendedVoicesForCharacter(char?.tags || [], customVoices);
  const primaryVoice = voices[0] || NEUTRAL_GENTLE_VOICE;
  const emoji = primaryVoice.emojis[0] || '🐾';
  const normTag = normalizeStr(primaryVoice.tag);
  const openSceneHint = extractOpenSceneAtmosphereHint(inMemoryOpenScene);

  let rawTemplates: string[] = [];

  if (action === 'pet') {
    if (normTag.includes('lạnh') || normTag.includes('chiếm hữu') || normTag.includes('ngạo')) {
      rawTemplates = [
        `Nhìn {gọi} xoa đầu bé ${petName} dịu dàng thế kia, {xưng} cũng hơi ghen tị với bé rồi đấy ${emoji}`,
        `Bé ${petName} ngoan thật, cứ dụi vào tay {gọi} mãi. Vuốt ve bé xong rồi thì qua ngồi cạnh {xưng} nhé ${emoji}`,
      ];
    } else if (normTag.includes('hài') || normTag.includes('tinh nghịch') || normTag.includes('năng động')) {
      rawTemplates = [
        `Haha {gọi} nhìn kìa, được {gọi} vuốt ve một cái là bé ${petName} tít cả mắt lại luôn rồi! ${emoji}`,
        `Bé ${petName} thích {gọi} ra mặt luôn đó, để {xưng} với {gọi} cùng cưng nựng bé nha ${emoji}`,
      ];
    } else {
      rawTemplates = [
        `Nhìn bé ${petName} lim dim nằm ngoan trong tay {gọi} kìa, {xưng} ngắm hai đứa thôi cũng thấy bình yên lắm ${emoji}`,
        `Đôi tay của {gọi} lúc nào cũng ấm áp cả, bảo sao bé ${petName} cứ quấn lấy {gọi} và {xưng} không rời ${emoji}`,
      ];
    }
  } else if (action === 'feed') {
    rawTemplates = [
      `{Gọi} chăm bé ${petName} khéo thật đấy, nhìn bé ăn ngon lành chưa kìa. Chăm bé xong {xưng} cũng pha sẵn món ngon đợi {gọi} rồi nhé ${emoji}`,
      `Có {gọi} cùng {xưng} chăm bữa ăn cho bé ${petName}, góc nhỏ này lúc nào cũng rộn ràng và ấm cúng ${emoji}`,
    ];
  } else if (action === 'play') {
    rawTemplates = [
      `Tiếng cười của {gọi} khi đùa cùng bé ${petName} làm cả căn phòng của {xưng} và {gọi} sáng bừng lên đó ${emoji}`,
      `Bé ${petName} chạy lon ton quanh chân {gọi} trông đáng yêu quá, lại đây nghỉ một chút với {xưng} nào ${emoji}`,
    ];
  } else if (action === 'rest') {
    rawTemplates = [
      `Suỵt... bé ${petName} cuộn tròn ngủ ngoan rồi kìa, {gọi} lại đây ngồi tựa vào vai {xưng} cho đỡ mỏi nhé ${emoji}`,
      `Để bé ${petName} ngủ yên trên đệm ấm đi, giờ là khoảng thời gian tĩnh lặng của riêng {xưng} và {gọi} đó ${emoji}`,
    ];
  } else {
    // action === 'select'
    rawTemplates = [
      `Bé ${petName} (${petSpecies}) này ngoan lắm, mỗi lần {gọi} chưa tới là bé cứ ngồi cạnh {xưng} ngóng ra cửa đợi {gọi} mãi thôi ${emoji}`,
      `{Xưng} rất thích ngắm lúc {gọi} chơi đùa cùng bé ${petName}, cảm giác căn phòng nhỏ của {xưng} và {gọi} thật sự là một tổ ấm ${emoji}`,
    ];
  }

  if (bondPoints >= 60) {
    rawTemplates.push(
      `Cảm ơn {gọi} đã cùng {xưng} yêu thương và chăm sóc bé ${petName}${openSceneHint ? ` giữa ${openSceneHint}` : ''}, ở bên {gọi} lúc nào lòng {xưng} cũng thật trọn vẹn 💗`
    );
  }

  const picked = rawTemplates[Math.floor(Math.random() * rawTemplates.length)];
  const finalLine = applyAddressPairToDialogue(picked, pair, char?.name);

  return {
    text: `“${finalLine.replace(/^[“"]|[”"]$/g, '').trim()}”`,
    addressPair: pair,
  };
}

// ============================================================================
// CHỌN LOÀI THÚ CƯNG & TÍNH CÁCH THEO TAG (LƯU CỐ ĐỊNH CHO TỪNG THÚ)
// ============================================================================
function loadSavedPetTraitsMap(): Record<string, PersistedPetTrait> {
  return dataStore.get<Record<string, PersistedPetTrait>>(
    PET_TRAITS_STORAGE_KEY,
    {}
  );
}

function savePetTraitsMap(map: Record<string, PersistedPetTrait>): void {
  dataStore.set(PET_TRAITS_STORAGE_KEY, map, true);
}

export function getPersistedTraitForPet(
  petId: string,
  petName: string,
  customPets: TagPetProfile[] = DEFAULT_TAG_PETS
): PersistedPetTrait | null {
  const map = loadSavedPetTraitsMap();
  if (map[petId]) return map[petId];
  if (petName && map[`name:${petName.toLowerCase()}`]) {
    return map[`name:${petName.toLowerCase()}`];
  }

  // Nếu chưa có trong map nhưng tên thú bắt đầu bằng tên một loài thú trong bảng tag_pets -> suy ra cố định theo tên thú!
  const pool =
    Array.isArray(customPets) && customPets.length > 0
      ? customPets
      : DEFAULT_TAG_PETS;
  const lowerName = (petName || '').toLowerCase();

  for (const profile of pool) {
    for (const sp of profile.speciesList) {
      if (lowerName.includes(sp.toLowerCase())) {
        const trait: PersistedPetTrait = {
          petSpecies: sp,
          matchedTag: profile.tag,
          personality: profile.personality,
          behaviorStyle: profile.behaviorStyle,
          sound: profile.sounds[0] || 'Meo~ 🌸',
          vibeReason: sanitizePetVibeNote(profile.vibeNote, profile.tag, sp),
        };
        persistTraitForPet(petId, petName, trait);
        return trait;
      }
    }
  }

  return null;
}

export function persistTraitForPet(
  petId: string,
  petName: string,
  trait: PersistedPetTrait
): void {
  const map = loadSavedPetTraitsMap();
  const cleanTrait: PersistedPetTrait = {
    ...trait,
    vibeReason: sanitizePetVibeNote(
      trait.vibeReason,
      trait.matchedTag,
      trait.petSpecies
    ),
  };
  if (petId) {
    map[petId] = cleanTrait;
  }
  if (petName) {
    map[`name:${petName.toLowerCase()}`] = cleanTrait;
  }
  savePetTraitsMap(map);
}

/**
 * Chọn loài thú và tính cách khi nhận thú từ Gacha:
 * - Ưu tiên khớp nhiều tag của char đang đồng hành nhất.
 * - Có chút ngẫu nhiên trong nhóm điểm cao để không nhàm chán.
 * - Ghi chú dưới thú CHỈ nói về VIBE và TÍNH CÁCH của thú, tuyệt đối không nhắc tên char!
 */
export function selectPetTraitForCompanionTags(
  charTags: string[],
  customPets: TagPetProfile[] = DEFAULT_TAG_PETS
): PersistedPetTrait {
  const pool =
    Array.isArray(customPets) && customPets.length > 0
      ? customPets
      : DEFAULT_TAG_PETS;
  const normalizedCharTags = (charTags || [])
    .map((t) => normalizeStr(t))
    .filter(Boolean);

  // Chấm điểm từng profile thú theo mức độ khớp với danh sách tag của char
  const scored = pool.map((profile) => {
    let score = 0;
    const normProfileTag = normalizeStr(profile.tag);

    normalizedCharTags.forEach((ct, idx) => {
      // Trọng số ưu tiên 2-3 tag đầu của char
      const weight = idx === 0 ? 5 : idx === 1 ? 4 : idx === 2 ? 3 : 2;
      if (ct === normProfileTag) {
        score += weight * 3;
      } else if (
        profile.keywords.some((kw) => {
          const nkw = normalizeStr(kw);
          return nkw && (ct.includes(nkw) || nkw.includes(ct));
        })
      ) {
        score += weight * 2;
      }
    });

    return {
      profile,
      // Thêm chút ngẫu nhiên nhẹ (0..2.2) để giữa các tag khớp cùng nhân vật có sự đa dạng thú vị
      finalScore: score + Math.random() * 2.2,
      rawMatches: score,
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);

  // Lấy nhóm ứng viên khớp tốt nhất (nếu có nhiều tag khớp thì chọn ngẫu nhiên có trọng số trong top 2)
  const topCandidates = scored.filter(
    (s) => s.rawMatches > 0 && s.rawMatches >= scored[0].rawMatches * 0.65
  );

  const chosenEntry =
    topCandidates.length > 0
      ? topCandidates[Math.floor(Math.random() * Math.min(2, topCandidates.length))]
      : scored[0];

  const chosenProfile = chosenEntry?.profile || pool[0];
  const speciesList =
    chosenProfile.speciesList.length > 0
      ? chosenProfile.speciesList
      : ['Mèo Bông'];
  const species = speciesList[Math.floor(Math.random() * speciesList.length)];
  const sound =
    chosenProfile.sounds[
      Math.floor(Math.random() * chosenProfile.sounds.length)
    ] || 'Meo~ 🌸';

  const vibeReason = sanitizePetVibeNote(
    chosenProfile.vibeNote ||
      `Bé ${species.toLowerCase()} có tính cách ${chosenProfile.personality}, rất hợp với không khí ${chosenProfile.tag.toLowerCase()} nơi đây.`,
    chosenProfile.tag,
    species
  );

  return {
    petSpecies: species,
    matchedTag: chosenProfile.tag,
    personality: chosenProfile.personality,
    behaviorStyle: chosenProfile.behaviorStyle || 'gentle_sway',
    sound,
    vibeReason,
  };
}
