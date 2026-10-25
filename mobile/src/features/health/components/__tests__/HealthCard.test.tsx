import type { HealthData } from '@allinone/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useGetHealthQuery } from '../../api';
import { HealthCard } from '../HealthCard';

jest.mock('../../api', () => ({ useGetHealthQuery: jest.fn() }));

const mockedHook = jest.mocked(useGetHealthQuery);
const refetch = jest.fn();

function mockQuery(state: Partial<ReturnType<typeof useGetHealthQuery>>) {
  mockedHook.mockReturnValue({
    data: undefined,
    error: undefined,
    isLoading: false,
    isFetching: false,
    refetch,
    ...state,
  } as ReturnType<typeof useGetHealthQuery>);
}

const HEALTHY: HealthData = {
  status: 'ok',
  uptime: 3725,
  timestamp: '2026-10-25T08:45:10.032Z',
  db: 'connected',
  redis: 'connected',
};

beforeEach(() => {
  refetch.mockClear();
});

// RNTL 14: render and fireEvent are async and must be awaited.
describe('HealthCard', () => {
  it('shows a skeleton while loading', async () => {
    mockQuery({ isLoading: true, isFetching: true });
    await render(<HealthCard />);

    expect(screen.getByLabelText('Loading server status')).toBeOnTheScreen();
    expect(screen.queryByTestId('health-summary')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows API, DB and Redis status, uptime and server time on success', async () => {
    mockQuery({ data: HEALTHY });
    await render(<HealthCard />);

    expect(screen.getByTestId('health-summary')).toHaveTextContent(
      'API: ok · DB: connected · Redis: connected',
    );
    expect(screen.getByText('Database')).toBeOnTheScreen();
    expect(screen.getByText('Redis')).toBeOnTheScreen();
    expect(screen.getByText('1 h 2 min')).toBeOnTheScreen();
    expect(screen.getByText('Server time')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Loading server status')).toBeNull();
  });

  it('shows a disconnected service as text, not only colour', async () => {
    mockQuery({ data: { ...HEALTHY, redis: 'disconnected' } });
    await render(<HealthCard />);

    expect(screen.getByTestId('health-summary')).toHaveTextContent(/Redis: disconnected$/);
    expect(screen.getByText('disconnected')).toBeOnTheScreen();
  });

  it('refetches when "Check again" is pressed', async () => {
    mockQuery({ data: HEALTHY });
    await render(<HealthCard />);

    await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows the error message and retries on Retry', async () => {
    mockQuery({
      error: { status: 0, code: 'NETWORK_ERROR', message: "Can't reach the server" },
    });
    await render(<HealthCard />);

    expect(screen.getByText('Server unavailable')).toBeOnTheScreen();
    expect(screen.getByText("Can't reach the server")).toBeOnTheScreen();
    expect(screen.queryByTestId('health-summary')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('disables Retry while a retry is in flight', async () => {
    mockQuery({
      error: { status: 0, code: 'NETWORK_ERROR', message: "Can't reach the server" },
      isFetching: true,
    });
    await render(<HealthCard />);

    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(retry).toBeDisabled();
    await fireEvent.press(retry);
    expect(refetch).not.toHaveBeenCalled();
  });
});
