/**
 * RevenueCat subscription service.
 *
 * Keys are read from app.config.js extra → set REVENUECAT_IOS_API_KEY and
 * REVENUECAT_ANDROID_API_KEY in your environment / EAS secrets.
 */
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import type { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const IOS_KEY: string = extra.revenueCatIosKey ?? '';
const ANDROID_KEY: string = extra.revenueCatAndroidKey ?? '';

export const ENTITLEMENT_ID = 'CarId Pro';

export const SubscriptionService = {
  /**
   * Initialize RevenueCat. Call this once after the user logs in, passing
   * their user UUID so RevenueCat can match webhook events to the correct user.
   */
  async initialize(userId: string): Promise<void> {
    const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    await Purchases.configure({ apiKey, appUserID: userId });
  },

  /**
   * Fetch the current RevenueCat offering. Returns the first available
   * package (the monthly subscription), or null if none are available.
   */
  async getOfferings(): Promise<PurchasesPackage | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current?.availablePackages[0] ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Trigger the native store purchase sheet for the given package.
   * Throws if the purchase fails. Check error.userCancelled to distinguish
   * user dismissals from genuine errors.
   */
  async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  },

  /**
   * Restore prior purchases — use when the user reinstalls or switches devices.
   */
  async restorePurchases(): Promise<CustomerInfo> {
    return await Purchases.restorePurchases();
  },

  /**
   * Check whether the current user has an active CarId Pro entitlement.
   */
  async checkEntitlement(): Promise<boolean> {
    try {
      const info = await Purchases.getCustomerInfo();
      return this.isEntitlementActive(info);
    } catch {
      return false;
    }
  },

  /**
   * Synchronously check entitlement status from a CustomerInfo object.
   */
  isEntitlementActive(customerInfo: CustomerInfo): boolean {
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  },
};
