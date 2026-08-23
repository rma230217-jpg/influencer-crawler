-- 카테고리 추가: 건강 / 헬스 / 사주
alter type channel_category add value if not exists '건강';
alter type channel_category add value if not exists '헬스';
alter type channel_category add value if not exists '사주';
