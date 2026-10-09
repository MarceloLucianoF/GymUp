import { renderHook, act } from '@testing-library/react';
import { useRestTimer } from './useRestTimer';
import { activeWorkoutService } from '../services/activeWorkoutService';

jest.mock('../services/activeWorkoutService', () => ({
  activeWorkoutService: { playRestBeep: jest.fn() }
}));

const finishTimer = (options) => {
  const onFinish = jest.fn();
  renderHook(() => useRestTimer({ endTime: Date.now() + 500, onFinish, onAdjust: jest.fn(), ...options }));
  act(() => { jest.advanceTimersByTime(1000); });
  return onFinish;
};

describe('useRestTimer: preferências de vibração e som', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    navigator.vibrate = jest.fn();
  });
  afterEach(() => { jest.useRealTimers(); });

  test('vibra e toca por padrão', () => {
    const onFinish = finishTimer();
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
    expect(activeWorkoutService.playRestBeep).toHaveBeenCalledTimes(1);
  });

  test('vibração desligada não vibra, mas toca', () => {
    finishTimer({ vibrate: false });
    expect(navigator.vibrate).not.toHaveBeenCalled();
    expect(activeWorkoutService.playRestBeep).toHaveBeenCalledTimes(1);
  });

  test('som desligado não toca, mas vibra', () => {
    finishTimer({ sound: false });
    expect(activeWorkoutService.playRestBeep).not.toHaveBeenCalled();
    expect(navigator.vibrate).toHaveBeenCalledTimes(1);
  });

  test('ambos desligados: apenas finaliza', () => {
    const onFinish = finishTimer({ vibrate: false, sound: false });
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(navigator.vibrate).not.toHaveBeenCalled();
    expect(activeWorkoutService.playRestBeep).not.toHaveBeenCalled();
  });
});
