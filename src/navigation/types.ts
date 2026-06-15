export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type TabsParamList = {
  Home: undefined;
  Scan: undefined;
  Classes: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  Tabs: { screen?: keyof TabsParamList } | undefined;
  Training: undefined;
  Rewards: undefined;
  BeltJourney: undefined;
};
