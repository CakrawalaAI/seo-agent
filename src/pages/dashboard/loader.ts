export async function loader(_args?: { context: { queryClient: any }; search?: Record<string, unknown> | URLSearchParams }) {
  // No server data required; dashboard uses client queries.
  // Accepts legacy args for compatibility with old onboarding tests.
  return null
}
