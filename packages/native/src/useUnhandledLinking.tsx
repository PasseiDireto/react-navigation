import {
  getStateFromPath,
  NavigationContext,
  useRoute,
} from '@react-navigation/core';
import React from 'react';
import { Platform } from 'react-native';

import { extractPathFromURL } from './extractPathFromURL';
import { LinkingContext } from './LinkingContext';

export function useUnhandledLinking() {
  const navigation = React.useContext(NavigationContext);
  const linking = React.useContext(LinkingContext);

  const { name: routeName } = useRoute();
  const { options, lastUnhandledLinking } = linking;

  if (navigation == null) {
    throw Error(
      "Couldn't find a navigation context. Is your component inside NavigationContainer?"
    );
  }

  if (options == null) {
    console.warn(
      `Looks like you're using 'useLinkingOnConditionalRender' hook inside ${routeName} screen without configured links. This has no effect. Either provide linking configuration to the NavigationContainer or remove this hook to get rid of this warning.`
    );
  }

  /*
   * Function to handle last unhandled URL. This function has to be called when the conditional
   * rendering of the navigator is about to happen e.g. in the `onPress` of a log in button.
   */
  const handleLastLinking = () => {
    if (options == null || lastUnhandledLinking?.current == null) {
      // noop, nothing to handle
      return;
    }

    const { config, prefixes } = options;

    // at web, the path is already extracted
    const path = Platform.select({
      native: extractPathFromURL(prefixes, lastUnhandledLinking.current),
      default: lastUnhandledLinking.current,
    });

    // First, we parse the URL to get the desired state
    const getStateFromPathHelper =
      options?.getStateFromPath ?? getStateFromPath;

    let rootState = getStateFromPathHelper(path ?? '', config);

    if (!rootState) {
      // is that possible?
      return;
    }

    const parent = navigation.getParent();
    if (parent) {
      // Then, we consider a portion of the state.
      const parentState = navigation.getParent()!.getState();
      const outerRouteName = parentState.routeNames[parentState.index];
      let state: typeof rootState | undefined = rootState;
      while (state?.routes[0].name !== outerRouteName && state) {
        state = state.routes[0].state;
      }
      if (!state) {
        return;
      }
      const innerState = state.routes[0].state;
      if (!innerState) {
        return;
      }
      rootState = innerState;
    }

    // Once we have the state, we can tell React Navigation to use it for next route names change (conditional rendering logic change)
    navigation.setStateForNextRouteNamesChange(rootState);

    // Finally, we clear unhandled link after it was handled
    lastUnhandledLinking.current = undefined;
  };

  return { handleLastLinking, lastUnhandledLinking };
}
