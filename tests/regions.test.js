import { REGIONS, isValidRegion, regionNames } from '../src/data/regions.js';

describe('regions — 행정구역 데이터/검증', () => {
  test('17개 시/도가 있다', () => {
    expect(REGIONS).toHaveLength(17);
  });

  test('서울(11)은 25개 시군구를 가진다', () => {
    const seoul = REGIONS.find(r => r.code === '11');
    expect(seoul).toBeDefined();
    expect(seoul.sigungu).toHaveLength(25);
  });

  test('isValidRegion: 존재하는 시도+시군구 조합은 true', () => {
    expect(isValidRegion('11', '11680')).toBe(true); // 서울 강남구
  });

  test('isValidRegion: 없는 시도는 false', () => {
    expect(isValidRegion('99', '11680')).toBe(false);
  });

  test('isValidRegion: 시도는 맞지만 시군구가 다른 시도 소속이면 false', () => {
    expect(isValidRegion('11', '41110')).toBe(false); // 41110은 경기 수원
  });

  test('regionNames: 코드로 표시명을 돌려준다', () => {
    expect(regionNames('11', '11680')).toEqual({ sidoName: '서울특별시', sigunguName: '강남구' });
  });

  test('regionNames: 잘못된 조합이면 null 이름', () => {
    expect(regionNames('99', '00000')).toEqual({ sidoName: null, sigunguName: null });
  });
});
