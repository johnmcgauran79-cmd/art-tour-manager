import { useNavigate, useLocation, NavigateOptions } from "react-router-dom";
import { useCallback } from "react";

export interface NavigationState {
  from?: string;
  tab?: string;
  search?: string;
  returnTo?: string;
  preserveState?: boolean;
}

/**
 * Custom hook for navigation with context preservation
 * Automatically tracks where user came from and preserves tab/filter state
 */
export const useNavigationContext = () => {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Navigate to a path while preserving current location as context
   */
  const navigateWithContext = useCallback((
    to: string,
    options?: {
      state?: NavigationState;
      replace?: boolean;
      preserveSearch?: boolean;
    }
  ) => {
    const currentTab = new URLSearchParams(location.search).get('tab');
    const currentSearch = new URLSearchParams(location.search).get('search');
    
    const navigationState: NavigationState = {
      from: location.pathname,
      tab: currentTab || undefined,
      search: currentSearch || undefined,
      ...options?.state,
    };

    console.log('[useNavigationContext] navigateWithContext called:', {
      to,
      location: location.pathname + location.search,
      currentTab,
      currentSearch,
      customState: options?.state,
      finalState: navigationState,
    });

    const navigateOptions: NavigateOptions = {
      state: navigationState,
      replace: options?.replace,
    };

    navigate(to, navigateOptions);
  }, [navigate, location]);

  /**
   * Go back to previous location using stored context
   * Falls back to provided default if no context available
   */
  const goBack = useCallback((defaultPath: string = "/") => {
    const state = location.state as NavigationState;
    
    console.log('[useNavigationContext] goBack called:', {
      defaultPath,
      locationState: state,
      location: location.pathname + location.search,
    });
    
    if (state?.from) {
      // Reconstruct the full URL with tab and search params
      let returnPath = state.from;
      const params = new URLSearchParams();
      
      if (state.tab) {
        params.set('tab', state.tab);
      }
      if (state.search) {
        params.set('search', state.search);
      }
      
      const queryString = params.toString();
      if (queryString) {
        returnPath += `?${queryString}`;
      }
      
      console.log('[useNavigationContext] Navigating back to:', returnPath);
      navigate(returnPath, { replace: true });
    } else {
      console.log('[useNavigationContext] No state.from, using default:', defaultPath);
      navigate(defaultPath, { replace: true });
    }
  }, [navigate, location.state]);

  /**
   * Get the return path from current location state
   */
  const getReturnPath = useCallback((defaultPath: string = "/"): string => {
    const state = location.state as NavigationState;
    
    if (state?.from) {
      let returnPath = state.from;
      const params = new URLSearchParams();
      
      if (state.tab) {
        params.set('tab', state.tab);
      }
      if (state.search) {
        params.set('search', state.search);
      }
      
      const queryString = params.toString();
      if (queryString) {
        returnPath += `?${queryString}`;
      }
      
      return returnPath;
    }
    
    return defaultPath;
  }, [location.state]);

  /**
   * Check if we have navigation context
   */
  const hasNavigationContext = useCallback((): boolean => {
    const state = location.state as NavigationState;
    return !!state?.from;
  }, [location.state]);

  return {
    navigateWithContext,
    goBack,
    getReturnPath,
    hasNavigationContext,
    currentState: location.state as NavigationState,
  };
};
