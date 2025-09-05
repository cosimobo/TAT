'use client'
export function checkFamilyCode(input: string) {
  const code = process.env.NEXT_PUBLIC_FAMILY_CODE
  return code && input.trim() === code.trim()
}
