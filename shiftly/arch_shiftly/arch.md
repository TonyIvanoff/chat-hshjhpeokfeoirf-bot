# Moving & Logistics Platform Analysis & Architectural Plan

## 1. Executive Summary
This document outlines the architectural design and implementation plan for a scalable, secure, and modular logistics platform. The platform connects clients (individuals and businesses) with removal/logistics service providers (independent drivers or companies). It emphasizes a seamless user experience using AI for item recognition, automated volume/weight calculation, and dynamic quoting.

## 2. System Architecture

### 2.1 High-Level Architecture
The system follows a Microservices-based modular architecture (logically) using Firebase as the backend-as-a-service (BaaS) to ensure scalability and speed of development.

**Core Components:**
1.  **Client Application (Mobile - Flutter):** For booking, item cataloging (AI), and status tracking.
2.  **Provider Application (Mobile - Flutter):** For order acceptance, driver assignment, fleet tracking, and order fulfillment.
3.  **Web Admin Panel (Web - React or Flutter Web):** For platform super-admins to manage users, orders, prices, and disputes.
4.  **Backend Services (Firebase Cloud Functions):** Business logic, AI integration, PDF generation, Pricing Engine.
5.  **AI/ML Service:** External or hosted model for image recognition.

### 2.2 Functional Modules

| Module | Responsibilities |
| :--- | :--- |
| **Auth Module** | Manages User/Provider authentication (Google, Apple, Email). Handles RBAC (Role Based Access Control). |
| **Order Module** | Manages order lifecycle (Created -> Quoted -> Booked -> Assigned -> In Progress -> Completed). |
| **Logistics Module** | Handles geo-location, distance calculation, service selection, and pricing logic. |
| **AI Vision Module** | Processes images, detects items, estimates dimensions/weight/volume. |
| **Document Module** | Generates contract PDFs, captures signatures, stores secure documents. |
| **Provider Module** | Manages provider profiles, fleets, drivers, and real-time tracking (internal). |
| **Notification Module** | Push notifications and Emails (Order updates, Assignments). |

### 2.3 Architecture Diagram

```mermaid
graph TD
    subgraph Clients
        CA[Client App (Flutter)]
        PA[Provider App (Flutter)]
        WA[Admin Panel (Web)]
    end

    subgraph Firebase_Backend
        Auth[Firebase Auth]
        DB[(Firestore DB)]
        Storage[(Firebase Storage)]
        
        subgraph Cloud_Functions
            API[API Gateway / HTTPS Triggers]
            PE[Pricing Engine]
            OM[Order Manager]
            PDF[PDF Generator]
            Sec[Security/Masking Layer]
        end
    end

    subgraph External_Services
        AI[AI Vision Service (GCP Vision / OpenAI)]
        Maps[Google Maps API]
    end

    CA --> Auth
    PA --> Auth
    WA --> Auth
    
    CA --> API
    PA --> API
    WA --> API

    API --> PE
    API --> OM
    API --> PDF
    API --> Sec

    OM --> DB
    PE --> Maps
    Sec --> DB
    
    API --> AI
    API --> Storage
```

## 3. Technology Stack

*   **Front-End (Mobile):** Flutter (Dart) - Single codebase for iOS and Android.
*   **Web Admin:** Flutter Web or React Admin.
*   **Backend:** Node.js (via Firebase Cloud Functions).
*   **Database:** Cloud Firestore (NoSQL).
*   **Storage:** Firebase Storage (Images, PDFs).
*   **Authentication:** Firebase Auth (Identity Platform).
*   **AI/ML:** Google Cloud Vision API or OpenAI Vision API (GPT-4o) for high-level object detection and estimation.
*   **Maps/Geo:** Google Maps Platform (Places, Routes, Geocoding).

## 4. Key Functional Workflows

### 4.1 Client Booking Flow
1.  **Destination:** Input `From` (Country, City, Address) and `To`.
2.  **Date:** Select Pickup Date Range.
3.  **Inventory (AI):** 
    *   User opens camera or uploads gallery images.
    *   Images uploaded to temporary secure storage.
    *   Backend AI analyzes images -> Returns list of detected items + estimated Qty, CBM, Kg.
4.  **Review:** 
    *   User sees carousel of processed images.
    *   Below each image: List of items (Editable).
    *   Calculated Totals (CBM, Weight).
5.  **Contract:** 
    *   System generates PDF with details.
    *   User reviews and signs on screen (Signature capturing).
    *   User checks "Information Correct" box.
6.  **Service Selection:** 
    *   System matches Total CBM/Weight to Vehicle Types available in the Region.
    *   Options displayed: 
        *   **Driver Only** (Transport only).
        *   **Driver + Help** (Loading assistance).
        *   **Full Service** (Packing/Unpacking).
    *   Prices shown for each.
7.  **Order Placement:** User selects option -> Request Sent to Providers in Geo-region.

### 4.2 Provider Flow
1.  **Order Pool:** Providers in the region see new requests.
2.  **Acceptance:** Provider accepts order.
3.  **Assignment:** 
    *   Individual Provider: Self-assigns.
    *   Company Provider: Assigns specific driver/vehicle.
4.  **Tracking:** Provider Company tracks driver location (Realtime). Client sees only statuses (e.g., "Driver on the way").

## 5. Security Strategy & GDPR Compliance (EU/UK)

### 5.1 Privacy & Data Masking
To prevent data theft, strict masking policies are applied:
*   **Database Level:** All PII (Personally Identifiable Information) like Names, Phone Numbers, Specific Addresses are stored in a separate `EncryptedUser` collection or field-level encrypted.
*   **API Level:** API responses returning Order lists to Providers *mask* exact addresses (e.g., show "Berlin, Mitte" instead of "Main Str. 5, Apt 2") until the Order is officially Accepted and Confirmed.
*   **Access Control:** strict Firestore Security Rules. Only the assigned Provider can read full order details.

### 5.2 GDPR Compliance
*   **Right to be Forgotten:** Automated function to wipe user PII upon request (anonymize stats).
*   **Data Residency:** Firebase region set to `europe-west` (e.g., Belgium or Frankfurt).
*   **Consent:** Clear check-boxes for data processing during sign-up and booking.

## 6. Implementation Plan / Technical Task

### Phase 1: Foundation & Infrastructure (Weeks 1-2)
*   **Objective:** Set up environments, repo, and base authentication.
*   **Actions:**
    1.  Initialize Flutter Project (Monorepo setup for User App, Provider App).
    2.  Setup Firebase Project (Dev/Staging/Prod).
    3.  Configure Firebase Auth (Google, Apple, Email).
    4.  Create Firestore base Collections (`users`, `providers`, `orders`, `system_constants`).
    5.  Implement Base UI Layouts (Design System setup).

### Phase 2: AI Vision & Inventory Module (Weeks 3-4)
*   **Objective:** Enable image uploading and item logic.
*   **Actions:**
    1.  **Camera/Gallery Feature:** Implement image picker and compression.
    2.  **Cloud Function `analyzeImage`:**
        *   Integrate Vision API.
        *   Prompt Engineering (if using LLM) to output JSON: `{items: [{name, qty, est_cbm, est_kg}]}`.
    3.  **Inventory UI:**
        *   Carousel view for images.
        *   Editable List view for items below images.
        *   Logic to aggregate Total CBM and Total KG.

### Phase 3: Booking Flow & PDF Generation (Weeks 5-6)
*   **Objective:** Complete the flow from Address to Signature.
*   **Actions:**
    1.  **Google Places Auto-complete:** For "From" and "To" addresses.
    2.  **Date Picker:** Range selection UI.
    3.  **PDF Service:**
        *   Create Cloud Function `generateOrderSummaryPDF`.
        *   Inputs: User details, Addresses, Inventory List, Photos (Links).
        *   Output: PDF URL.
    4.  **Signature Pad:** Flutter widget to capture signature as PNG.
    5.  **Contract Logic:** Attach signature to PDF or record reference in DB.

### Phase 4: Pricing Engine & Service Levels (Weeks 7-8)
*   **Objective:** Dynamic pricing based on Volume/Weight/Distance.
*   **Actions:**
    1.  **Distance Matrix:** Calculate distance between From/To.
    2.  **Pricing Config:** Admin ability to set rates (Per Km, Per CBM, Per Floor).
    3.  **Service Tiers Logic:**
        *   *Economy*: Driver only (Constraint: Max 30kg/item).
        *   *Standard*: Driver + Helper.
        *   *Premium*: Full handling.
    4.  **Quote UI:** Display cards with different prices.

### Phase 5: Provider Application Logic (Weeks 9-10)
*   **Objective:** Managing Orders and Drivers.
*   **Actions:**
    1.  **Order Feed:** Geo-queried list of available orders.
    2.  **Driver Management:** Sub-collection for Company Providers to add drivers.
    3.  **Assignment:** UI to pick a driver for an accepted order.
    4.  **Real-time Tracking:** 
        *   Background Location Service on Driver App.
        *   Firestore updates for Driver Location (only visible to Manager).

### Phase 6: Admin Panel & Security Hardening (Weeks 11-12)
*   **Objective:** Management and Protection.
*   **Actions:**
    1.  **Admin Dashboard:** Tables for Users, Providers, Active Orders.
    2.  **Data Masking Implementation:** Ensure API middleware strips PII for unauthorized calls.
    3.  **Penetration Testing:** basic security audit.
    4.  **GDPR Tools:** "Export Data" and "Delete Account" buttons.

## 7. Data Models (Simplified)

### `users` collection
```json
{
  "uid": "string",
  "email": "string",
  "role": "client", 
  "profile": { "masked": true } // PII stored in sub-collection or separate secure collection
}
```

### `orders` collection
```json
{
  "orderId": "string",
  "clientId": "string",
  "status": "pending_quote | open | assigned | in_progress | completed",
  "locations": {
    "from": { "lat": 0, "lng": 0, "country": "UK", "city": "London", "display_address": "Masked..." },
    "to": { ... }
  },
  "inventory": {
    "total_cbm": 15.5,
    "total_kg": 500,
    "images": ["url1", "url2"],
    "items_breakdown": [...]
  },
  "service_tier": "standard",
  "price_quote": 150.00,
  "assigned_provider_id": null,
  "assigned_driver_id": null,
  "pickup_window": { "start": "timestamp", "end": "timestamp" },
  "contract_pdf_url": "url",
  "signature_url": "url"
}
```

### `providers` collection
```json
{
  "providerId": "string",
  "type": "individual | company",
  "verified": true,
  "fleet": [{ "vehicleId": "v1", "cbm_capacity": 20 }],
  "drivers": [{ "driverId": "d1", "name": "John", "status": "active" }]
}
```
