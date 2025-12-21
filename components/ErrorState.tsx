import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { AlertCircle, ExternalLink, ShieldQuestion } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type Props = {
  title?: string;
  description?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again.',
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: Props) {
  return (
    <View className="w-full items-center rounded-2xl border border-border bg-card px-6 py-8">
      <Icon as={AlertCircle} className="text-destructive" size={32} />
      <Text variant="h4" className="mt-3 text-center">
        {title}
      </Text>
      <Text variant="muted" className="mt-2 text-center leading-6">
        {description}
      </Text>

      <View className="mt-5 w-full gap-3">
        {primaryActionLabel && onPrimaryAction ? (
          <Button onPress={onPrimaryAction} className="w-full">
            <Text className="text-primary-foreground">{primaryActionLabel}</Text>
            <Icon as={ExternalLink} className="text-primary-foreground" />
          </Button>
        ) : null}

        {secondaryActionLabel && onSecondaryAction ? (
          <Button variant="secondary" onPress={onSecondaryAction} className="w-full">
            <Icon as={ShieldQuestion} className="text-secondary-foreground" />
            <Text className="text-secondary-foreground">{secondaryActionLabel}</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );
}
