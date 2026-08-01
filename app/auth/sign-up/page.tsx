import AuthFormCard from "@/app/components/AuthFormCard";

export default function AuthSignUpPage() {
  return (
    <AuthFormCard
      mode="sign-up"
      title="Sign Up"
      subtitle="Access your Finops Pilot agent console."
      submitLabel="Sign Up"
      alternatePrompt="Already registered?"
      alternateHref="/auth/log-in"
      alternateLabel="Log In"
    />
  );
}
