# Corrections backend : MediCare Connect

Ce document résume ce qui a changé côté API et sert de **référence pour le front React**.
Il est unique et vit à la racine du dépôt (`BACKEND_CHANGES.md`).
La documentation interactive complète reste sur `/api/docs/` (Swagger) ; `backend/schema.yaml` est régénéré.

## 1. Démarrage

Ce document est à la **racine du dépôt**. Toutes les commandes ci-dessous se lancent depuis `backend/` :

```bash
cd backend

# 1. Environnement virtuel (Python 3.12) et dépendances
python -m venv .venv
.venv\Scripts\activate            # Linux/Mac : source .venv/bin/activate
pip install -r requirements.txt

# 2. Configuration
copy .env.example .env            # Linux/Mac : cp .env.example .env  — puis remplir les valeurs

# 3. Base de données et compte administrateur
python manage.py migrate          # users.0005 (manager), services.0002 (couleur), billing.0002 (département de la facture) et laboratory.0002 (date de prélèvement) : aucun effet sur les données existantes
python manage.py createsuperuser  # le compte reçoit automatiquement le rôle ADMIN

# 4. Lancer et tester
python manage.py runserver        # http://127.0.0.1:8000 — API et Swagger sur /api/docs/
python manage.py test             # 83 tests
```

`manage.py`, `requirements.txt`, `schema.yaml` et `backend/README.md` se trouvent dans `backend/`.

Régénérer le schéma après toute modification de l'API :
`python manage.py spectacular --file schema.yaml --validate`

## 2. Sécurité

| Avant | Maintenant |
|---|---|
| Identifiants PostgreSQL, `SECRET_KEY` et `DEBUG=True` écrits dans `settings.py` | Tout vient de variables d'environnement (`.env`, ignoré par Git) |
| Tout utilisateur connecté pouvait tout lire / modifier / supprimer | Permissions par rôle sur chaque endpoint (§4), **refus par défaut** |
| `POST /api/auth/register/` ouvert à tous | Réservé à l'ADMIN, qui choisit le rôle |
| `/api/audit/` testait `is_staff` | Teste le rôle ADMIN |
| Pas de mot de passe fort à la création de compte | Validateurs Django appliqués |
| `createsuperuser` créait un compte sans rôle | Crée un ADMIN |

En production (`DJANGO_DEBUG=false`), l'application refuse de démarrer sans `DJANGO_SECRET_KEY`.

## 3. Ce qui a été ajouté pour le front

- **CORS** : origines autorisées via `CORS_ALLOWED_ORIGINS` (par défaut `localhost:5173`, `127.0.0.1:5173`, `localhost:3000`).
- **Pagination** sur toutes les listes : `?page=2&page_size=50` (20 par défaut, 100 max).
  Réponse : `{ "count", "next", "previous", "results": [...] }`.
  ⚠️ Les listes ne renvoient plus un tableau brut.
- **Recherche** `?search=`, **tri** `?ordering=-created_at` et **filtres** par champ (`?status=`, `?doctor=3`, `?appointment_date=2026-10-01`, `?appointment_date__gte=…`).
  Les champs disponibles pour chaque endpoint sont listés dans Swagger.
- **Médicaments** : champs `current_stock` et `is_low_stock`, et filtre `?low_stock=true` (alertes stock).
- **Utilisateurs** : `GET/PATCH /api/auth/users/` (ADMIN), filtrable par `?role=DOCTOR` pour remplir le formulaire de création d'un médecin.
- **Dashboard** : `GET /api/stats/dashboard/?months=12` (§6).
- **Couleur des départements** : chaque service (`/api/services/`) a un champ `theme_color` (`MARINE` ou `VERT`, `MARINE` par défaut), modifiable par l'ADMIN. Le front s'en sert pour colorer le logo et le cachet imprimés (§4 ter).
- **Département d'une facture** : `POST /api/invoices/` accepte `service` (id d'un service actif, optionnel, corrigeable ensuite). La facture renvoie aussi `service_detail` (`name`, `theme_color`) et `patient_detail` (nom, numéro, téléphone) pour l'impression, et se filtre par `?service=`.
- **Fiche médecin connecté** : `GET /api/doctors/me/` renvoie la fiche `Doctor` (dont son `id`) du compte connecté, 404 sinon.
- Fuseau horaire `Africa/Bujumbura` et langue `fr` (les datetimes sortent en `+02:00`, les messages de validation DRF en français).

## 4. Permissions par rôle

L'ADMIN a toujours accès à tout. Lecture = GET ; écriture = POST/PUT/PATCH ; la suppression (DELETE) est **ADMIN uniquement** sauf mention contraire.

| Ressource | Lecture | Écriture |
|---|---|---|
| patients | tout le personnel (médecin : ses patients seulement) | RECEPTIONIST ; DOCTOR modifie ses patients mais n'en crée pas |
| doctors, services, specialties | tout le personnel | ADMIN |
| appointments | DOCTOR (les siens), RECEPTIONIST | RECEPTIONIST ; DOCTOR : `status` et `notes` seulement |
| consultations, medical-history | DOCTOR | DOCTOR |
| prescriptions, prescription-items | DOCTOR, PHARMACIST | DOCTOR, PHARMACIST ¹ |
| lab/tests | DOCTOR, LABORANT | LABORANT |
| lab/requests | DOCTOR, LABORANT | DOCTOR, LABORANT |
| lab/results | DOCTOR, LABORANT | LABORANT |
| billing-items | RECEPTIONIST, CASHIER | ADMIN |
| invoices, payments | RECEPTIONIST, CASHIER | RECEPTIONIST, CASHIER |
| invoice-items | RECEPTIONIST, CASHIER | RECEPTIONIST, CASHIER (y compris DELETE) |
| medications | DOCTOR, PHARMACIST, RECEPTIONIST, CASHIER | PHARMACIST |
| medication-batches, stock-movements | PHARMACIST | PHARMACIST |
| audit | ADMIN | lecture seule |
| auth/users, auth/register | ADMIN | ADMIN |
| notifications | chaque utilisateur voit les siennes | idem |

¹ Le pharmacien peut modifier une ordonnance pour la marquer délivrée. Un endpoint `dispense` dédié serait plus strict (voir §7).

## 4 bis. Un médecin ne voit que ses propres données

Pour un compte DOCTOR, l'API filtre elle-même (le front n'a rien à filtrer) :

| Ressource | Ce que le médecin voit |
|---|---|
| appointments | ses rendez-vous |
| consultations | ses consultations |
| prescriptions, prescription-items | ses ordonnances |
| lab/requests, lab/results | ses demandes d'examens et leurs résultats |
| patients | ceux qui ont **un rendez-vous ou une consultation avec lui** |
| medical-history | l'historique de ses patients |
| dashboard | ses propres chiffres (patients, rendez-vous, consultations, examens) |

- Un objet d'un autre médecin répond **404** (pas 403) : on ne révèle même pas qu'il existe.
- À l'écriture, le médecin ne peut agir qu'en son nom (`doctor` = lui), sur un patient qui est le sien, et sur sa propre consultation / ordonnance. Sinon : 403.
- Un médecin **ne crée ni patient ni rendez-vous** (c'est le travail de la réception) et, sur un rendez-vous, il ne peut modifier que `status` et `notes`. Sans cela il pourrait se faire attribuer n'importe quel patient.
- **Conséquence pour le parcours** : la réception enregistre le patient puis crée le rendez-vous ; le patient apparaît alors chez le médecin. Une consultation « sans rendez-vous » n'est possible que pour un patient déjà suivi par ce médecin.
- Un compte DOCTOR sans fiche `Doctor` ne voit rien et ne peut rien écrire. Penser à créer la fiche (`POST /api/doctors/`, ADMIN) quand on crée le compte.
- ADMIN, réception, laboratoire, pharmacie et caisse ne sont pas concernés : leur vue reste globale.

## 4 ter. Département imprimé sur les documents (logo et cachet)

Un « département » est un **service** de l'API (`/api/services/` : `name`, `theme_color`). Le front n'invente rien : le bandeau du cachet affiche `name` et la couleur vient de `theme_color`. Aucun service n'existe dans la base fournie : l'ADMIN les crée (Consultation, Laboratoire, etc.) avec la couleur voulue.

D'où vient le département de chaque document, avec ce que l'API contient déjà :

| Document | Département | Statut |
|---|---|---|
| Ordonnance | `doctor.service` du médecin prescripteur | disponible |
| Consultation | `doctor.service` (ou `appointment.service`) | disponible |
| Rendez-vous | `service` | disponible |
| Facture | `invoice.service`, choisi à la création par la réception / la caisse | disponible |
| Demande / résultat d'examen | aucun lien actuel (voir §4 quater) | **à décider** |

Un médecin sans service renseigné : le cachet s'imprime avec le nom de l'hôpital seul, en marine.

## 4 ter bis. Données d'impression par document

Chaque document s'imprime à partir d'**une seule réponse de l'API** (le front n'invente rien) :

| Document | Endpoint | Champs utiles à l'impression |
|---|---|---|
| Facture | `/api/invoices/{id}/` | `patient_detail`, `service_detail`, `items`, totaux, `status` |
| Reçu | `/api/payments/{id}/` | `patient_detail`, `service_detail` (département de la facture), `invoice_number`, `invoice_total`, `invoice_balance`, `amount`, `payment_method`, `reference`, `payment_date`, `received_by_name` |
| Ordonnance | `/api/prescriptions/{id}/` | `patient_detail` (sexe, date de naissance), `doctor_detail` (nom, n° d'ordre, `service_detail`), `items[].medication_name` |
| Compte rendu | `/api/consultations/{id}/` | `patient_detail`, `doctor_detail`, `reason`, `diagnosis`, `observations`, `treatment_plan` |
| Résultats Labo | `/api/lab/results/{id}/` | voir §4 quater (`patient_detail` inclut sexe et date de naissance) |

⚠️ `invoice_balance` est le reste à payer **actuel** de la facture, pas au moment du paiement. Pour réimprimer un ancien reçu, le front ne doit pas l'afficher comme « reste après ce paiement ».

## 4 quater. Examens de laboratoire : le résultat arrive un autre jour

Une demande d'examen suit un cycle, avec une date à chaque étape importante :

`REQUESTED` (demande, `requested_at`) → `SAMPLE_COLLECTED` (prélèvement, `sample_collected_at`, posé automatiquement) → `IN_PROGRESS` → `RESULT_AVAILABLE` (résultat saisi) → `VALIDATED` (`completed_at`, posé automatiquement). `CANCELLED` est possible avant la validation.

- **Laboratoire** : fait avancer le statut jusqu'à `IN_PROGRESS`, puis saisit le résultat (`POST /api/lab/results/`) : la demande passe seule à `RESULT_AVAILABLE`. Un résultat ne peut pas être ajouté à une demande annulée ou déjà validée.
- **Validation** : `POST /api/lab/results/{id}/validate/` enregistre `validated_by` / `validated_at`, passe la demande à `VALIDATED` et crée une **notification** (`type = LAB_RESULT`) pour le médecin demandeur uniquement. Une seconde validation répond 400, et un résultat validé n'est plus modifiable.
- **Médecin** : ne peut que **annuler** sa demande (les statuts `RESULT_AVAILABLE` / `VALIDATED` ne se posent jamais à la main).
- Les dates `sample_collected_at` et `completed_at` sont en lecture seule.
- Pour l'impression, les demandes et résultats renvoient `patient_detail`, `lab_test_detail` (nom, valeurs normales), `doctor_name`, et le résultat renvoie `request_detail` et `validated_by_name`.
- **Feuille de résultats** : document **séparé** de la facture, à imprimer seulement une fois le résultat `VALIDATED`, avec les dates de demande, de prélèvement et de validation.
- Reste à décider : rattacher chaque type d'examen (`LabTest`) à un département pour que le cachet de la feuille se remplisse seul.

## 5. Authentification : à savoir pour le client Axios

- `POST /api/auth/login/` avec `{"email", "password"}` (l'**email**, pas le username).
  Réponse : `{ access, refresh, user: {id, username, email, first_name, last_name, phone, gender, role, status, ...} }`.
  Le rôle est aussi dans le JWT (claim `role`).
- Mauvais identifiants : **HTTP 400** (pas 401). Le refresh automatique ne doit donc se déclencher que sur 401 hors `/login/`.
- `access` : 15 min. `POST /api/auth/refresh/` avec `{"refresh"}` renvoie **uniquement** `{access}` (le refresh n'est pas renouvelé, il vit 7 jours).
- `POST /api/auth/logout/` avec `{"refresh"}` : met le refresh en liste noire (HTTP 205).
- Compte désactivé ou suspendu : 401 sur toutes les requêtes.
- Rôle insuffisant : **HTTP 403** avec un champ `detail` en français (le texte varie selon l'endpoint : le front doit afficher son propre message plutôt que celui-ci).
- Réinitialisation du mot de passe : l'email contient un lien vers `PASSWORD_RESET_URL?uid=…&token=…`. Cette URL est une **page du front** qui appelle `POST /api/auth/password-reset-confirm/` avec `{uid, token, new_password}`.

## 6. Dashboard : `GET /api/stats/dashboard/?months=12`

Chaque rôle ne reçoit que ses sections (la liste est dans `sections`) :

| Rôle | Sections |
|---|---|
| ADMIN | patients, doctors, appointments, consultations, lab, billing, pharmacy |
| DOCTOR | patients, appointments, consultations, lab |
| RECEPTIONIST | patients, doctors, appointments, billing |
| CASHIER | billing |
| LABORANT | lab |
| PHARMACIST | pharmacy |

Les séries mensuelles sont complètes (les mois vides valent 0) : `[{ "month": "2026-10", "value": 12 }, ...]`, directement utilisables par Recharts.
Les montants sont des nombres (float) et la devise n'est pas incluse : le front l'affiche (FBU).
`months` est borné entre 1 et 24.

## 7. Limites connues / décisions à prendre

1. **Cloisonnement par médecin** : fait (§4 bis). Reste à décider si un médecin peut voir les consultations passées d'un patient auprès d'un *autre* médecin (par exemple en cas de transfert) : aujourd'hui non.
2. **Délivrance des ordonnances** : voir note ¹ ; un endpoint `POST /prescriptions/{id}/dispense/` qui décrémente le stock serait plus sûr.
3. **Stock** : `current_stock` additionne tous les lots, y compris périmés. Le dashboard signale séparément les lots périmés (`expired_count`).
4. **Création automatique** : les factures et mouvements de stock ne sont pas générés automatiquement depuis une consultation ou une prescription ; c'est à faire côté front ou par des signaux Django.
5. **Audit** : le modèle `AuditLog` existe mais rien n'y écrit encore.
6. **Notifications** : aucune n'est créée automatiquement (rappels de rendez-vous, stock bas).
7. Les endpoints `/api/docs/` et `/api/schema/` sont publics ; à restreindre en production.
