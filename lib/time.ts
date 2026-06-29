export type VitalStatus = "active" | "aging" | "dormant";

export function daysSince(isoDate: string): number {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function vitalStatus(days: number, archived: boolean): VitalStatus {
  if (archived) return "dormant";
  if (days <= 30) return "active";
  if (days <= 365) return "aging";
  return "dormant";
}

export function timeAgoKo(isoDate: string): string {
  const days = daysSince(isoDate);
  if (days <= 0) return "오늘";
  if (days === 1) return "1일 전";
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  const years = Math.floor(months / 12);
  return `${years}년 전`;
}
