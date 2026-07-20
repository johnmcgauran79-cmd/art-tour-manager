import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';

const ForgotPassword = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string).trim();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsLoading(false);

    if (error) {
      toast({
        title: 'Could not send reset email',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setSent(true);
    toast({
      title: 'Check your email',
      description: 'If an account exists for that email, a reset link has been sent.',
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img
            src="/lovable-uploads/901098e1-7efa-42e5-a1db-3d16e421375f.png"
            alt="Australian Racing Tours Logo"
            className="h-16 w-16 mx-auto"
          />
          <h1 className="mt-6 text-3xl font-bold text-brand-navy">Reset your password</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        <Card className="border-brand-navy/20 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-brand-navy">Forgot Password</CardTitle>
            <CardDescription>
              {sent ? 'Reset link sent — check your inbox.' : 'We will email you a secure link'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!sent && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2 text-brand-navy">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="Enter your email"
                    className="border-brand-navy/30 focus:border-brand-navy"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-brand-navy hover:bg-brand-navy/90 text-brand-yellow"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Send reset link'}
                </Button>
              </form>
            )}
            <div className="mt-4 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-sm text-brand-navy hover:underline"
              >
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;