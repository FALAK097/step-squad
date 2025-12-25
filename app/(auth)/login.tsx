import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/lib/hooks/useAuth';
import { Footprints, TrendingUp, Users } from 'lucide-react-native';
import * as React from 'react';
import { View, Image } from 'react-native';
import Animated, { FadeIn, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const ONBOARDING_STEPS = [
  {
    title: 'Step Squad',
    description: 'Track your steps and stay active with your friends.',
    icon: Footprints,
    color: 'bg-zinc-900 dark:bg-zinc-100',
    iconColor: 'text-zinc-100 dark:text-zinc-900',
  },
  {
    title: 'Milestones',
    description: 'Set daily goals and track your progress with precision.',
    icon: TrendingUp,
    color: 'bg-zinc-900 dark:bg-zinc-100',
    iconColor: 'text-zinc-100 dark:text-zinc-900',
  },
  {
    title: 'The Squad',
    description: 'Connect with Google to start your journey today.',
    icon: Users,
    color: 'bg-zinc-900 dark:bg-zinc-100',
    iconColor: 'text-zinc-100 dark:text-zinc-900',
  },
];

export default function LoginScreen() {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const { signInWithGoogle } = useAuth();

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const step = ONBOARDING_STEPS[currentStep];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="justify-between flex-1 px-10 py-16">
        {/* Minimal Progress Indicator */}
        <View className="mb-8 flex-row justify-center gap-1.5">
          {ONBOARDING_STEPS.map((_, index) => (
            <View
              key={index}
              className={`h-1 w-8 rounded-full ${index === currentStep ? 'bg-foreground' : 'bg-muted'}`}
            />
          ))}
        </View>

        {/* Hero Section */}
        <Animated.View
          key={currentStep}
          entering={SlideInRight.springify().damping(22).stiffness(150)}
          exiting={SlideOutLeft}
          className="items-center justify-center flex-1">
          <View
            className={`h-24 w-24 ${step.color} mb-12 items-center justify-center rounded-[28px] shadow-sm`}>
            <Icon as={step.icon} size={42} className={step.iconColor} />
          </View>

          <Text className="text-3xl font-semibold tracking-tight text-center text-foreground">
            {step.title}
          </Text>

          <Text className="mt-4 max-w-[280px] text-center text-base leading-relaxed text-muted-foreground">
            {step.description}
          </Text>
        </Animated.View>

        {/* Action Area */}
        <View className="mt-auto">
          {currentStep < ONBOARDING_STEPS.length - 1 ? (
            <Button
              onPress={handleNext}
              size="lg"
              className="h-14 rounded-2xl bg-foreground active:opacity-90">
              <Text className="font-medium text-background">Continue</Text>
            </Button>
          ) : (
            <Animated.View entering={FadeIn.duration(400)}>
              <Button
                onPress={handleGoogleSignIn}
                disabled={isSigningIn}
                size="lg"
                variant="outline"
                className="h-14 flex-row items-center gap-3 rounded-2xl border-[1px] border-border bg-card active:bg-accent">
                <Image
                  source={require('@/assets/images/google.png')}
                  style={{ width: 20, height: 20 }}
                />
                <Text className="font-medium text-foreground">
                  {isSigningIn ? 'Signing in...' : 'Continue with Google'}
                </Text>
              </Button>
            </Animated.View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
