import AuthFormCard from "@/app/components/AuthFormCard";

export default function AuthLogInPage() {
  return (
    <AuthFormCard
      mode="log-in"
      title="Log In"
      subtitle="Continue to your Finops Pilot workspace."
      submitLabel="Log In"
      alternatePrompt="New to Finops Pilot?"
      alternateHref="/auth/sign-up"
      alternateLabel="Sign Up"
    />
  );
}
