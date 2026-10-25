import type { DbStatus, RedisStatus } from '@allinone/shared';
import { Text, View } from 'react-native';
import { Button, Card, ErrorState, Skeleton, StatusPill, type StatusTone } from '@/components/ui';
import type { AppError } from '@/store/normalizeError';
import { formatDuration, formatTime } from '@/utils/format';
import { useGetHealthQuery } from '../api';

function toneFor(status: DbStatus | RedisStatus): StatusTone {
  if (status === 'connected') return 'success';
  if (status === 'connecting' || status === 'disconnecting') return 'warning';
  return 'danger';
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="min-h-8 flex-row items-center justify-between gap-3">
      <Text className="text-base text-muted">{label}</Text>
      {children}
    </View>
  );
}

/** Shows the API, database and Redis status from GET /health. */
export function HealthCard() {
  const { data, error, isLoading, isFetching, refetch } = useGetHealthQuery();

  return (
    <Card accessibilityLabel="Server status">
      <Text className="text-lg font-semibold text-ink" accessibilityRole="header">
        Server status
      </Text>

      {isLoading ? (
        <View className="gap-3" accessibilityLabel="Loading server status" testID="health-loading">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-2/3" />
        </View>
      ) : error ? (
        <ErrorState
          title="Server unavailable"
          message={(error as AppError).message ?? "Can't reach the server"}
          onRetry={refetch}
          retrying={isFetching}
        />
      ) : data ? (
        <View className="gap-2">
          <Text className="text-base font-medium text-ink" testID="health-summary">
            {`API: ${data.status} · DB: ${data.db} · Redis: ${data.redis}`}
          </Text>
          <Row label="API">
            <StatusPill label={data.status} tone="success" />
          </Row>
          <Row label="Database">
            <StatusPill label={data.db} tone={toneFor(data.db)} />
          </Row>
          <Row label="Redis">
            <StatusPill label={data.redis} tone={toneFor(data.redis)} />
          </Row>
          <Row label="Uptime">
            <Text className="text-base text-ink">{formatDuration(data.uptime)}</Text>
          </Row>
          <Row label="Server time">
            <Text className="text-base text-ink">{formatTime(data.timestamp)}</Text>
          </Row>
          <Button
            label="Check again"
            variant="secondary"
            onPress={refetch}
            loading={isFetching}
            accessibilityHint="Asks the server for its status again"
          />
        </View>
      ) : null}
    </Card>
  );
}
