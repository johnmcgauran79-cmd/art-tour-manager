
import { CheckCircle, XCircle } from "lucide-react";

interface PasswordStrengthValidatorProps {
  password: string;
  className?: string;
}

export const PasswordStrengthValidator = ({ password, className }: PasswordStrengthValidatorProps) => {
  const requirements = [
    {
      test: (pwd: string) => pwd.length >= 8,
      message: "At least 8 characters"
    },
    {
      test: (pwd: string) => /[A-Z]/.test(pwd),
      message: "At least one uppercase letter"
    },
    {
      test: (pwd: string) => /[a-z]/.test(pwd),
      message: "At least one lowercase letter"
    },
    {
      test: (pwd: string) => /\d/.test(pwd),
      message: "At least one number"
    },
    {
      test: (pwd: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      message: "At least one special character"
    }
  ];

  const passedRequirements = requirements.filter(req => req.test(password));
  const strength = (passedRequirements.length / requirements.length) * 100;

  return (
    <div className={className}>
      <div className="mb-2">
        <div className="flex justify-between text-sm">
          <span>Password Strength</span>
          <span className={
            strength < 40 ? "text-red-500" : 
            strength < 80 ? "text-yellow-500" : 
            "text-green-500"
          }>
            {strength < 40 ? "Weak" : strength < 80 ? "Good" : "Strong"}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              strength < 40 ? "bg-red-500" : 
              strength < 80 ? "bg-yellow-500" : 
              "bg-green-500"
            }`}
            style={{ width: `${strength}%` }}
          />
        </div>
      </div>
      
      <div className="space-y-1">
        {requirements.map((req, index) => {
          const passed = req.test(password);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              {passed ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className={passed ? "text-green-700" : "text-red-700"}>
                {req.message}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
