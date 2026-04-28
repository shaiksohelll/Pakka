export function DemoModeBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm">
      🟡 Demo Mode — OTP is 123456 for any +91 number. No real SMS sent.
    </div>
  );
}
