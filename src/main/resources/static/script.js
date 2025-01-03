const apiUrl = '/api';
let cart = [];

// Track pending updates to prevent race conditions
let pendingUpdates = new Map();
const jwt_token = 'jwt_token';

document.addEventListener('DOMContentLoaded', () => {
    setupAuthEventListeners();
    setupMainEventListeners();
    checkAuthAndRender();
});

/**
 * Sets up main event listeners for search inputs, navigation buttons, and customer-specific actions.
 */
function setupMainEventListeners() {
    document.getElementById('searchType')?.addEventListener('change', updateSearchInputs);
    document.getElementById('searchBtn')?.addEventListener('click', searchBooks);
    document.getElementById('homeBtn')?.addEventListener('click', showHome);

    if (!hasRole('admin')) {
        document.getElementById('viewCartBtn')?.addEventListener('click', viewCart);
        document.getElementById('viewHistoryBtn')?.addEventListener('click', viewPurchaseHistory);
        document.getElementById('recommendedBtn')?.addEventListener('click', showRecommendedBooks);
    }
}

/**
 * Updates the UI to show or hide customer-specific actions based on the user's role.
 */
function updateRoleBasedUI() {
    const customerActions = document.getElementById('customerActions');
    const isCustomer = !hasRole('admin');

    if (customerActions) {
        customerActions.style.display = isCustomer ? 'flex' : 'none';
        if (isCustomer && !document.getElementById('recommendedBtn')) {
            const recommendedBtn = document.createElement('button');
            recommendedBtn.id = 'recommendedBtn';
            recommendedBtn.className = 'nav-button';
            recommendedBtn.innerHTML = `
                <i class="fas fa-star"></i>
                Recommended
            `;
            recommendedBtn.addEventListener('click', showRecommendedBooks);
            customerActions.appendChild(recommendedBtn);
        }
    }
}

/**
 * Sets up authentication-related event listeners for login, signup modals, and form submissions.
 */
function setupAuthEventListeners() {
    document.getElementById('welcomeLoginBtn')?.addEventListener('click', () => {
        document.getElementById('loginModal').style.display = 'block';
    });

    document.getElementById('welcomeSignupBtn')?.addEventListener('click', () => {
        document.getElementById('signupModal').style.display = 'block';
    });

    document.getElementById('closeLogin')?.addEventListener('click', () => {
        document.getElementById('loginModal').style.display = 'none';
    });

    document.getElementById('closeSignup')?.addEventListener('click', () => {
        document.getElementById('signupModal').style.display = 'none';
    });

    setupUserMenu();

    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('signupForm')?.addEventListener('submit', handleSignup);

    window.addEventListener('click', (event) => {
        const loginModal = document.getElementById('loginModal');
        const signupModal = document.getElementById('signupModal');
        if (event.target === loginModal) {
            loginModal.style.display = 'none';
        } else if (event.target === signupModal) {
            signupModal.style.display = 'none';
        }
    });
}

/**
 * Initializes user menu event listeners for toggling, logout, and editing profile.
 */
function setupUserMenu() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', toggleUserMenu);
    }

    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    document.addEventListener('click', (event) => {
        const userMenu = document.querySelector('.user-menu');
        const dropdown = document.querySelector('.user-dropdown');
        if (!userMenu?.contains(event.target) && dropdown?.classList.contains('show')) {
            dropdown.classList.remove('show');
        }
    });

    document.getElementById('editProfileBtn')?.addEventListener('click', showEditProfileModal);
}

/**
 * Toggles the visibility of the user menu dropdown.
 *
 * @param {Event} event - The click event triggering the toggle.
 */
function toggleUserMenu(event) {
    event.stopPropagation();
    const dropdown = document.querySelector('.user-dropdown');
    dropdown?.classList.toggle('show');
}

/**
 * Checks the authentication status and renders the appropriate UI.
 */
function checkAuthAndRender() {
    const token = getAuthToken();
    const mainContent = document.getElementById('mainContent');
    const authContent = document.getElementById('authContent');
    const userMenu = document.querySelector('.user-menu');

    if (token) {
        if (authContent) authContent.style.display = 'none';
        if (mainContent) {
            mainContent.style.display = 'block';
            mainContent.classList.add('fade-in');
        }
        if (userMenu) {
            userMenu.style.display = 'block';
            setupUserMenu();
        }

        updateRoleBasedUI();
        setupMainEventListeners();
        updateUserMenu();
        showHome();
    } else {
        if (authContent) {
            authContent.style.display = 'flex';
            authContent.classList.add('fade-in');
        }
        if (mainContent) mainContent.style.display = 'none';
        if (userMenu) userMenu.style.display = 'none';
    }
}

/**
 * Updates the user menu with the current user's information.
 */
function updateUserMenu() {
    const user = getCurrentUser();
    if (!user) return;

    const userInitial = document.querySelector('.user-initial');
    if (userInitial) {
        userInitial.textContent = user.sub.charAt(0);
    }

    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        userInfo.innerHTML = `
            <div>${user.sub}</div>
            <div style="opacity: 0.7; font-size: 0.9em;">${user.role}</div>
        `;
    }
}

/**
 * Handles the login form submission and authentication process.
 *
 * @param {Event} event - The form submit event.
 */
function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
        .then(response => {
            if (!response.ok) throw new Error('Login failed');
            return response.json();
        })
        .then(data => {
            if (data.token) {
                localStorage.setItem(jwt_token, data.token);
                document.getElementById('loginModal').style.display = 'none';
                document.getElementById('loginForm').reset();
                checkAuthAndRender();
            }
        })
        .catch(error => {
            console.error('Error logging in:', error);
            alert('Login failed. Please check your credentials.');
        });
}

/**
 * Handles the signup form submission and user registration process.
 *
 * @param {Event} event - The form submit event.
 */
function handleSignup(event) {
    event.preventDefault();

    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const firstName = document.getElementById('signupFirstName').value.trim();
    const lastName = document.getElementById('signupLastName').value.trim();

    if (!username || !password || !email || !firstName || !lastName) {
        alert("All fields are required.");
        return;
    }

    fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, firstName, lastName })
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.message || 'Signup failed');
                });
            }
            return response.json();
        })
        .then(data => {
            alert('Signup successful! Please log in.');
            document.getElementById('signupModal').style.display = 'none';
            document.getElementById('loginModal').style.display = 'block';
            document.getElementById('signupForm').reset();
        })
        .catch(error => {
            console.error('Error signing up:', error);
            alert(`Signup failed: ${error.message}`);
        });
}

/**
 * Handles user logout by clearing authentication token and resetting the UI.
 */
function handleLogout() {
    localStorage.removeItem(jwt_token);
    cart = [];
    updateCartCount();
    checkAuthAndRender();
}

/**
 * Displays the edit profile form for the current user.
 */
function showEditProfileModal() {
    const user = getCurrentUser();
    if (!user) return;

    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="edit-profile-container">
            <h2>Edit Profile</h2>
            <form id="editProfileForm">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="profileUsername" value="${user.sub}" disabled>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="profileEmail" required>
                </div>
                <div class="form-group">
                    <label>First Name</label>
                    <input type="text" id="profileFirstName" required>
                </div>
                <div class="form-group">
                    <label>Last Name</label>
                    <input type="text" id="profileLastName" required>
                </div>
                <div class="form-group">
                    <label>New Password (leave blank to keep current)</label>
                    <input type="password" id="profilePassword">
                </div>
                <button type="submit">Save Changes</button>
            </form>
        </div>
    `;

    document.getElementById('editProfileForm').addEventListener('submit', handleProfileUpdate);
}

/**
 * Handles the profile update form submission.
 *
 * @param {Event} event - The form submit event.
 */
function handleProfileUpdate(event) {
    event.preventDefault();
    const token = getAuthToken();
    const user = getCurrentUser();
    if (!token || !user) {
        alert('You must be logged in to update your profile.');
        return;
    }

    const formData = {
        email: document.getElementById('profileEmail').value.trim(),
        firstName: document.getElementById('profileFirstName').value.trim(),
        lastName: document.getElementById('profileLastName').value.trim(),
        password: document.getElementById('profilePassword').value
    };

    if (!formData.password) {
        delete formData.password;
    }

    fetch(`${apiUrl}/users/${user.userId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update profile');
            }
            return response.json();
        })
        .then(data => {
            alert('Profile updated successfully!');
            showHome();
        })
        .catch(error => {
            console.error('Error updating profile:', error);
            alert('Failed to update profile. Please try again.');
        });
}

/**
 * Handles the scenario when the authentication token has expired.
 */
function handleExpiredToken() {
    localStorage.removeItem(jwt_token);
    cart = [];
    updateCartCount();
    checkAuthAndRender();
    alert('Your session has expired. Please log in again.');
}

/**
 * Retrieves and validates the authentication token from local storage.
 *
 * @returns {string|null} The valid authentication token or null if invalid.
 */
function getAuthToken() {
    const token = localStorage.getItem(jwt_token);
    if (!token) {
        return null;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
            handleExpiredToken();
            return null;
        }
        return token;
    } catch (error) {
        console.error('Error checking token:', error);
        handleExpiredToken();
        return null;
    }
}

/**
 * Decodes and returns the current user's information from the authentication token.
 *
 * @returns {Object|null} The user object or null if not authenticated.
 */
function getCurrentUser() {
    const token = getAuthToken();
    if (!token) return null;

    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        return {
            sub: decoded.sub,
            role: decoded.role,
            userId: decoded.userId
        };
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
}

/**
 * Checks if the current user has a specific role.
 *
 * @param {string} role - The role to check against.
 * @returns {boolean} True if the user has the role, false otherwise.
 */
function hasRole(role) {
    const user = getCurrentUser();
    return user && user.role === role;
}

/**
 * Fetches and displays the list of books for customers.
 */
function loadBooks() {
    fetch(`${apiUrl}/books`)
        .then(response => response.json())
        .then(books => {
            displayBooks(books);
        })
        .catch(error => {
            console.error('Error fetching books:', error);
        });
}

/**
 * Determines whether to load the admin view or customer view.
 */
function showHome() {
    if (hasRole('admin')) {
        loadAdminView();
    } else {
        loadBooks();
    }
}

/**
 * Fetches and displays recommended books for the current user
 */
function showRecommendedBooks() {
    const token = getAuthToken();
    if (!token) {
        alert('Please log in to see recommendations.');
        return;
    }

    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="purchase-history-container">
            <h2>Recommended Books for You</h2>
            <div id="recommendationsContent" class="loading">Loading recommendations...</div>
        </div>
    `;

    fetch(`${apiUrl}/books/recommended`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch recommendations');
            }
            return response.json();
        })
        .then(books => {
            const recommendationsContent = document.getElementById('recommendationsContent');

            if (!books || books.length === 0) {
                recommendationsContent.innerHTML = `
                    <div class="empty-recommendations">
                        <p>No recommendations available yet. Try purchasing more books to get personalized recommendations!</p>
                        <button onclick="showHome()" class="return-home">Browse Books</button>
                    </div>
                `;
                return;
            }

            // Create bookshelf container for recommendations
            recommendationsContent.innerHTML = `
                <div class="bookshelf-container">
                    <button class="scroll-btn scroll-left">
                        <i class="fas fa-angle-left"></i>
                    </button>
                    <div class="books-row"></div>
                    <button class="scroll-btn scroll-right">
                        <i class="fas fa-angle-right"></i>
                    </button>
                </div>
            `;

            const booksRow = recommendationsContent.querySelector('.books-row');

            books.forEach(book => {
                const bookDiv = document.createElement('div');
                bookDiv.className = 'book';
                bookDiv.setAttribute('data-book-id', book.id);

                const author = book.author || 'Unknown Author';
                const imageUrl = book.imageName ? `/api/books/image/${book.imageName}` : '/api/placeholder/200/300';

                bookDiv.innerHTML = `
                    <div class="book-content">
                        <div class="book-image">
                            <img src="${imageUrl}" alt="${book.title}" loading="lazy">
                        </div>
                        <h2>${book.title}</h2>
                        <p class="author">${author}</p>
                        <div class="book-price">$${book.price ? book.price.toFixed(2) : 'N/A'}</div>
                        ${book.inventory > 0 ? `
                            <button class="addToCartBtn" onclick="event.stopPropagation();" data-id="${book.id}">
                                Add to Cart
                            </button>
                        ` : '<button disabled>Out of Stock</button>'}
                    </div>
                `;

                // Add click event to show full book details
                bookDiv.addEventListener('click', () => showBookDetails(book));

                // Add click event for add to cart button
                const addToCartBtn = bookDiv.querySelector('.addToCartBtn');
                if (addToCartBtn) {
                    addToCartBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        addToCart(e);
                    });
                }

                booksRow.appendChild(bookDiv);
            });

            // Add scroll button functionality
            const booksContainer = recommendationsContent.querySelector('.bookshelf-container');
            const leftButton = booksContainer.querySelector('.scroll-left');
            const rightButton = booksContainer.querySelector('.scroll-right');

            leftButton.addEventListener('click', (e) => {
                e.stopPropagation();
                booksRow.scrollBy({ left: -300, behavior: 'smooth' });
            });

            rightButton.addEventListener('click', (e) => {
                e.stopPropagation();
                booksRow.scrollBy({ left: 300, behavior: 'smooth' });
            });

            // Update scroll button visibility
            const updateScrollButtons = () => {
                leftButton.style.display = booksRow.scrollLeft > 0 ? 'flex' : 'none';
                rightButton.style.display =
                    booksRow.scrollLeft < (booksRow.scrollWidth - booksRow.clientWidth) ? 'flex' : 'none';
            };

            booksRow.addEventListener('scroll', updateScrollButtons);
            updateScrollButtons();
        })
        .catch(error => {
            console.error('Error fetching recommendations:', error);
            content.innerHTML = `
                <div class="purchase-history-container">
                    <h2>Recommended Books</h2>
                    <div class="error-message">
                        <p>Sorry, we couldn't load your recommendations. Please try again later.</p>
                        <button onclick="showHome()" class="return-home">Return to Home</button>
                    </div>
                </div>
            `;
        });
}

/**
 * Updates the search input fields based on the selected search type.
 */
function updateSearchInputs() {
    const searchType = document.getElementById('searchType').value;
    const searchInput = document.getElementById('searchInput');
    const minValue = document.getElementById('minValue');
    const maxValue = document.getElementById('maxValue');

    searchInput.style.display = 'none';
    minValue.style.display = 'none';
    maxValue.style.display = 'none';

    if (searchType === 'title' || searchType === 'author' ||
        searchType === 'publisher' || searchType === 'isbn') {
        searchInput.style.display = 'inline-block';
        searchInput.placeholder = `Enter ${searchType}...`;
    } else if (searchType === 'price' || searchType === 'inventory') {
        minValue.style.display = 'inline-block';
        if (searchType === 'price') {
            maxValue.style.display = 'inline-block';
            minValue.placeholder = 'Min price';
            maxValue.placeholder = 'Max price';
        } else {
            minValue.placeholder = 'Min inventory';
        }
    }
}

/**
 * Handles the search action for books based on selected criteria.
 */
function searchBooks() {
    const searchType = document.getElementById('searchType').value;
    const searchInput = document.getElementById('searchInput').value.trim();
    const minValue = document.getElementById('minValue').value;
    const maxValue = document.getElementById('maxValue').value;
    let endpoint;

    switch (searchType) {
        case 'title':
            endpoint = `${apiUrl}/books/search?keyword=${encodeURIComponent(searchInput)}`;
            break;
        case 'author':
            endpoint = `${apiUrl}/books/search/author?author=${encodeURIComponent(searchInput)}`;
            break;
        case 'publisher':
            endpoint = `${apiUrl}/books/search/publisher?publisher=${encodeURIComponent(searchInput)}`;
            break;
        case 'isbn':
            endpoint = `${apiUrl}/books/search/isbn?isbn=${encodeURIComponent(searchInput)}`;
            break;
        case 'price':
            endpoint = `${apiUrl}/books/filter/price?minPrice=${encodeURIComponent(minValue)}&maxPrice=${encodeURIComponent(maxValue)}`;
            break;
        case 'inventory':
            endpoint = `${apiUrl}/books/filter/inventory?minInventory=${encodeURIComponent(minValue)}`;
            break;
        default:
            alert('Invalid search type selected.');
            return;
    }

    fetch(endpoint)
        .then(response => {
            if (!response.ok) {
                throw new Error('Search failed');
            }
            return response.json();
        })
        .then(books => {
            displayBooks(books);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while searching for books.');
        });
}

/**
 * Renders the list of books on the page.
 *
 * @param {Array} books - The array of book objects to display.
 */
function displayBooks(books) {
    const content = document.getElementById('content');
    content.innerHTML = '';

    if (books.length === 0) {
        content.innerHTML = '<p>No books found.</p>';
        return;
    }

    // Create container for the scrollable book shelf
    const bookshelfContainer = document.createElement('div');
    bookshelfContainer.className = 'bookshelf-container';

    // Add navigation buttons with Font Awesome arrows
    const leftButton = document.createElement('button');
    leftButton.className = 'scroll-btn scroll-left';
    leftButton.innerHTML = '<i class="fas fa-angle-left"></i>';

    const rightButton = document.createElement('button');
    rightButton.className = 'scroll-btn scroll-right';
    rightButton.innerHTML = '<i class="fas fa-angle-right"></i>';

    const booksRow = document.createElement('div');
    booksRow.className = 'books-row';

    bookshelfContainer.appendChild(leftButton);
    bookshelfContainer.appendChild(booksRow);
    bookshelfContainer.appendChild(rightButton);

    books.forEach(book => {
        const bookDiv = document.createElement('div');
        bookDiv.className = 'book';
        bookDiv.setAttribute('data-book-id', book.id);

        const author = book.author || 'Unknown Author';
        const imageUrl = book.imageName ? `/api/books/image/${book.imageName}` : '/api/placeholder/200/300';

        bookDiv.innerHTML = `
            <div class="book-content">
                <div class="book-image">
                    <img src="${imageUrl}" alt="${book.title}" loading="lazy">
                </div>
                <h2>${book.title}</h2>
                <p class="author">${author}</p>
            </div>
        `;

        // Add click event to show full book details
        bookDiv.addEventListener('click', () => showBookDetails(book));
        booksRow.appendChild(bookDiv);
    });

    content.appendChild(bookshelfContainer);

    // Add scroll button functionality
    leftButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        booksRow.scrollBy({ left: -300, behavior: 'smooth' });
    });

    rightButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        booksRow.scrollBy({ left: 300, behavior: 'smooth' });
    });

    // Update scroll button visibility
    const updateScrollButtons = () => {
        leftButton.style.display = booksRow.scrollLeft > 0 ? 'flex' : 'none';
        rightButton.style.display =
            booksRow.scrollLeft < (booksRow.scrollWidth - booksRow.clientWidth) ? 'flex' : 'none';
    };

    booksRow.addEventListener('scroll', updateScrollButtons);
    updateScrollButtons();
}

function showBookDetails(book) {
    const modal = document.createElement('div');
    modal.className = 'modal';

    const addToCartButton = !hasRole('admin') && book.inventory > 0
        ? `<button class="addToCartBtn" data-id="${book.id}">Add to Cart</button>`
        : book.inventory === 0 ? '<button disabled>Out of Stock</button>' : '';

    const adminButtons = hasRole('admin')
        ? `
            <button class="editBookBtn" data-id="${book.id}">Edit</button>
            <button class="deleteBookBtn" data-id="${book.id}">Delete</button>
          `
        : '';

    const imageUrl = book.imageName ? `/api/books/image/${book.imageName}` : '/api/placeholder/200/300';

    modal.innerHTML = `
        <div class="modal-content book-details-modal">
            <span class="close">&times;</span>
            <div class="book-details">
                <div class="book-image-container">
                    <img src="${imageUrl}" 
                         alt="${book.title}"
                         onload="this.style.opacity='1'"
                         onerror="this.src='/api/placeholder/200/300'">
                </div>
                <div class="book-info">
                    <h2>${book.title}</h2>
                    <p><strong>Author:</strong> ${book.author || 'Unknown Author'}</p>
                    <p><strong>ISBN:</strong> ${book.isbn || 'ISBN not available'}</p>
                    <p class="book-description"><strong>Description:</strong> ${book.description || 'No description available'}</p>
                    <p><strong>Price:</strong> $${book.price ? book.price.toFixed(2) : 'N/A'}</p>
                    <p><strong>Inventory:</strong> ${book.inventory > 0 ? `In Stock: ${book.inventory}` : 'Out of Stock'}</p>
                    <div class="book-buttons">
                        ${addToCartButton}
                        ${adminButtons}
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add fade-in effect for image
    const style = document.createElement('style');
    style.textContent = `
        .book-image-container img {
            opacity: 0;
            transition: opacity 0.3s ease;
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(modal);
    modal.style.display = 'block';

    // Close button functionality
    const closeBtn = modal.querySelector('.close');
    closeBtn.onclick = () => {
        modal.remove();
        // Remove the dynamic style when modal is closed
        style.remove();
    };

    // Click outside to close
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.remove();
            // Remove the dynamic style when modal is closed
            style.remove();
        }
    };

    // Handle escape key press
    const handleEscapeKey = (event) => {
        if (event.key === 'Escape') {
            modal.remove();
            style.remove();
            document.removeEventListener('keydown', handleEscapeKey);
        }
    };
    document.addEventListener('keydown', handleEscapeKey);

    // Add event listeners for buttons in the modal
    if (!hasRole('admin')) {
        modal.querySelectorAll('.addToCartBtn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent modal from closing
                addToCart(e);
            });
        });
    }

    if (hasRole('admin')) {
        modal.querySelectorAll('.editBookBtn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent modal from closing
                editBook(e);
                modal.remove(); // Close modal after clicking edit
                style.remove();
            });
        });
        modal.querySelectorAll('.deleteBookBtn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent modal from closing
                if (confirm('Are you sure you want to delete this book?')) {
                    deleteBook(e);
                    modal.remove(); // Close modal after confirming delete
                    style.remove();
                }
            });
        });
    }
}

/**
 * Loads the admin view with additional controls for managing books.
 */
function loadAdminView() {
    fetch(`${apiUrl}/books`)
        .then(response => response.json())
        .then(books => {
            displayBooks(books);
            const content = document.getElementById('content');
            const uploadButton = document.createElement('button');
            uploadButton.textContent = 'Add New Book';
            uploadButton.className = 'add-book-btn';
            uploadButton.addEventListener('click', showAddBookForm);
            content.prepend(uploadButton);
        })
        .catch(error => {
            console.error('Error fetching books:', error);
        });
}

/**
 * Displays the form for adding a new book.
 */
function showAddBookForm() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="book-form-container">
            <h2>Add New Book</h2>
            <form id="addBookForm">
                <div class="form-group">
                    <label>ISBN</label>
                    <input type="text" name="isbn" required>
                </div>
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" name="title" required>
                </div>
                <div class="form-group">
                    <label>Author</label>
                    <input type="text" name="author" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="description"></textarea>
                </div>
                <div class="form-group">
                    <label>Publisher</label>
                    <input type="text" name="publisher">
                </div>
                <div class="form-group">
                    <label>Image Name</label>
                    <input type="text" name="imageName" placeholder="e.g., harrypotter.png">
                    <small class="form-text">Enter the name of the image file located in the bookImages folder</small>
                </div>
                <div class="form-group">
                    <label>Price</label>
                    <input type="number" step="0.01" name="price" required>
                </div>
                <div class="form-group">
                    <label>Inventory</label>
                    <input type="number" name="inventory" required>
                </div>
                <div class="form-buttons">
                    <button type="submit">Add Book</button>
                    <button type="button" onclick="showHome()">Cancel</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('addBookForm').addEventListener('submit', submitNewBook);
}

/**
 * Submits the new book data to the server.
 *
 * @param {Event} event - The form submit event.
 */
function submitNewBook(event) {
    event.preventDefault();

    const token = getAuthToken();
    if (!token) {
        alert('You must be logged in to perform this action.');
        return;
    }

    if (!hasRole('admin')) {
        alert('You must be an administrator to add books.');
        return;
    }

    const formData = new FormData(event.target);
    const bookData = {};
    formData.forEach((value, key) => {
        bookData[key] = key === 'price' || key === 'inventory' ? Number(value) : value;
    });

    fetch(`${apiUrl}/books`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bookData)
    })
        .then(response => {
            if (response.ok) {
                alert('Book added successfully!');
                loadAdminView();
            } else if (response.status === 403) {
                throw new Error('You do not have permission to add books.');
            } else {
                return response.text().then(text => { throw new Error(text); });
            }
        })
        .catch(error => {
            console.error('Error adding book:', error);
            if (error.message.includes('ISBN')) {
                alert('A book with this ISBN already exists. Please use a different ISBN.');
            } else {
                alert('An error occurred while adding the book: ' + error.message);
            }
        });
}

/**
 * Fetches book data and displays the edit form.
 *
 * @param {Event} event - The click event triggering the edit.
 */
function editBook(event) {
    const bookId = event.target.getAttribute('data-id');
    fetch(`${apiUrl}/books/${bookId}`)
        .then(response => response.json())
        .then(book => {
            const content = document.getElementById('content');
            content.innerHTML = `
                <div class="book-form-container">
                    <h2>Edit Book</h2>
                    <form id="editBookForm">
                        <input type="hidden" name="id" value="${book.id}">
                        <div class="form-group">
                            <label>ISBN</label>
                            <input type="text" name="isbn" value="${book.isbn}" required>
                        </div>
                        <div class="form-group">
                            <label>Title</label>
                            <input type="text" name="title" value="${book.title}" required>
                        </div>
                        <div class="form-group">
                            <label>Author</label>
                            <input type="text" name="author" value="${book.author}" required>
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea name="description">${book.description || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Publisher</label>
                            <input type="text" name="publisher" value="${book.publisher || ''}">
                        </div>
                        <div class="form-group">
                            <label>Image Name</label>
                            <input type="text" name="imageName" value="${book.imageName || ''}" 
                                   placeholder="e.g., harrypotter.png">
                            <small class="form-text">Enter the name of the image file located in the bookImages folder</small>
                        </div>
                        <div class="form-group">
                            <label>Price</label>
                            <input type="number" step="0.01" name="price" value="${book.price}" required>
                        </div>
                        <div class="form-group">
                            <label>Inventory</label>
                            <input type="number" name="inventory" value="${book.inventory}" required>
                        </div>
                        <div class="form-buttons">
                            <button type="submit">Update Book</button>
                            <button type="button" onclick="showHome()">Cancel</button>
                        </div>
                    </form>
                </div>
            `;

            document.getElementById('editBookForm').addEventListener('submit', submitEditBook);
        })
        .catch(error => {
            console.error('Error fetching book data:', error);
            alert('An error occurred while fetching the book details.');
        });
}

/**
 * Submits the edited book data to the server.
 *
 * @param {Event} event - The form submit event.
 */
function submitEditBook(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const bookData = {};
    formData.forEach((value, key) => {
        bookData[key] = key === 'price' || key === 'inventory' ? Number(value) : value;
    });
    const bookId = bookData.id;

    const token = getAuthToken();
    if (!token) {
        alert('You must be logged in to perform this action.');
        return;
    }

    fetch(`${apiUrl}/books/${bookId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bookData)
    })
        .then(response => {
            if (response.ok) {
                alert('Book updated successfully!');
                loadAdminView();
            } else {
                return response.text().then(text => { throw new Error(text); });
            }
        })
        .catch(error => {
            console.error('Error updating book:', error);
            alert('An error occurred while updating the book: ' + error.message);
        });
}

/**
 * Deletes a book from the server.
 *
 * @param {Event} event - The click event triggering the delete.
 */
function deleteBook(event) {
    const bookId = event.target.getAttribute('data-id');
    const token = getAuthToken();
    if (!token) {
        alert('You must be logged in to perform this action.');
        return;
    }

    if (confirm('Are you sure you want to delete this book?')) {
        fetch(`${apiUrl}/books/${bookId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(response => {
                if (response.ok) {
                    alert('Book deleted successfully!');
                    loadAdminView();
                } else {
                    return response.text().then(text => { throw new Error(text); });
                }
            })
            .catch(error => {
                console.error('Error deleting book:', error);
                alert('An error occurred while deleting the book: ' + error.message);
            });
    }
}

/**
 * Adds a book to the shopping cart.
 *
 * @param {Event} event - The click event triggering the add to cart.
 */
function addToCart(event) {
    const bookId = event.target.getAttribute('data-id');

    if (!getAuthToken()) {
        alert('Please log in to add items to your cart.');
        return;
    }

    fetch(`${apiUrl}/books/${bookId}`)
        .then(response => response.json())
        .then(book => {
            const existingItem = cart.find(item => item.bookId === bookId);
            const currentQuantityInCart = existingItem ? existingItem.quantity : 0;

            if (currentQuantityInCart < book.inventory) {
                if (existingItem) {
                    existingItem.quantity += 1;
                } else {
                    cart.push({ bookId, quantity: 1 });
                }
                updateCartCount();
                showAddToCartAnimation(event.target);
            } else {
                alert('Cannot add more items than available in inventory.');
            }
        })
        .catch(error => {
            console.error('Error fetching book data:', error);
            alert('An error occurred while adding the item to the cart.');
        });
}

/**
 * Displays a visual animation when an item is added to the cart.
 *
 * @param {HTMLElement} button - The button element that was clicked.
 */
function showAddToCartAnimation(button) {
    button.classList.add('added-to-cart');
    setTimeout(() => {
        button.classList.remove('added-to-cart');
    }, 500);
}

/**
 * Updates the cart item count displayed in the UI.
 */
function updateCartCount() {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
        cartCount.textContent = totalItems;

        if (totalItems > 0) {
            cartCount.classList.add('cart-updated');
            setTimeout(() => cartCount.classList.remove('cart-updated'), 300);
        }
    }
}

/**
 * Displays the shopping cart to the user.
 */
function viewCart() {
    const content = document.getElementById('content');
    content.innerHTML = '<h2>Your Shopping Cart</h2>';

    if (!getAuthToken()) {
        content.innerHTML += '<p>Please log in to view your cart.</p>';
        return;
    }

    if (cart.length === 0) {
        content.innerHTML += `
            <div class="empty-cart">
                <p>Your cart is empty.</p>
                <button onclick="showHome()">Continue Shopping</button>
            </div>
        `;
        return;
    }

    const cartContainer = document.createElement('div');
    cartContainer.className = 'bookshelf-container';

    const booksRow = document.createElement('div');
    booksRow.className = 'books-row';

    const leftButton = document.createElement('button');
    leftButton.className = 'scroll-btn scroll-left';
    leftButton.innerHTML = '<i class="fas fa-angle-left"></i>';

    const rightButton = document.createElement('button');
    rightButton.className = 'scroll-btn scroll-right';
    rightButton.innerHTML = '<i class="fas fa-angle-right"></i>';

    let totalCost = 0;

    Promise.all(cart.map(item =>
        fetch(`${apiUrl}/books/${item.bookId}`)
            .then(response => response.json())
            .then(book => ({ book, quantity: item.quantity, bookId: item.bookId }))
    ))
        .then(bookItems => {
            bookItems.forEach(({ book, quantity, bookId }) => {
                const itemTotal = book.price * quantity;
                totalCost += itemTotal;

                const bookDiv = document.createElement('div');
                bookDiv.className = 'book';
                bookDiv.setAttribute('data-book-id', bookId);

                const author = book.author || 'Unknown Author';
                const imageUrl = book.imageName ? `/api/books/image/${book.imageName}` : '/api/placeholder/200/300';

                bookDiv.innerHTML = `
                    <div class="book-content">
                        <div class="book-image">
                            <img src="${imageUrl}" alt="${book.title}" loading="lazy">
                        </div>
                        <h2>${book.title}</h2>
                        <p class="author">${author}</p>
                        <div class="cart-item-controls">
                            <div class="quantity-controls">
                                <button class="quantity-btn minus-btn">-</button>
                                <span class="quantity">${quantity}</span>
                                <button class="quantity-btn plus-btn">+</button>
                            </div>
                            <p class="item-total">$${itemTotal.toFixed(2)}</p>
                            <button class="remove-item">Remove</button>
                        </div>
                    </div>
                `;

                // Add quantity control event listeners
                const minusBtn = bookDiv.querySelector('.minus-btn');
                const plusBtn = bookDiv.querySelector('.plus-btn');
                const removeBtn = bookDiv.querySelector('.remove-item');

                minusBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentQuantity = cart.find(item => item.bookId === bookId)?.quantity || 0;
                    updateCartItemQuantity(bookId, currentQuantity - 1, book.inventory);
                });

                plusBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentQuantity = cart.find(item => item.bookId === bookId)?.quantity || 0;
                    updateCartItemQuantity(bookId, currentQuantity + 1, book.inventory);
                });

                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeFromCart(bookId);
                });

                booksRow.appendChild(bookDiv);
            });

            cartContainer.appendChild(leftButton);
            cartContainer.appendChild(booksRow);
            cartContainer.appendChild(rightButton);
            content.appendChild(cartContainer);

            // Scroll button functionality
            leftButton.addEventListener('click', (e) => {
                e.stopPropagation();
                booksRow.scrollBy({ left: -300, behavior: 'smooth' });
            });

            rightButton.addEventListener('click', (e) => {
                e.stopPropagation();
                booksRow.scrollBy({ left: 300, behavior: 'smooth' });
            });

            const updateScrollButtons = () => {
                leftButton.style.display = booksRow.scrollLeft > 0 ? 'flex' : 'none';
                rightButton.style.display =
                    booksRow.scrollLeft < (booksRow.scrollWidth - booksRow.clientWidth) ? 'flex' : 'none';
            };

            booksRow.addEventListener('scroll', updateScrollButtons);
            updateScrollButtons();

            // Add checkout section
            const checkoutSection = document.createElement('div');
            checkoutSection.className = 'checkout-section';
            checkoutSection.innerHTML = `
                <div class="cart-summary">
                    <h3>Order Summary</h3>
                    <p><strong>Total Items: ${cart.reduce((total, item) => total + item.quantity, 0)}</strong></p>
                    <p><strong>Total Cost: $${totalCost.toFixed(2)}</strong></p>
                    <button id="checkoutBtn" class="checkout-btn">Proceed to Checkout</button>
                    <button onclick="showHome()" class="continue-shopping">Continue Shopping</button>
                </div>
            `;
            content.appendChild(checkoutSection);

            document.getElementById('checkoutBtn').addEventListener('click', checkout);
        });
}

/**
 * Updates the quantity of a cart item.
 *
 * @param {string} bookId - The ID of the book.
 * @param {number} newQuantity - The new quantity to set.
 */
function updateCartItemQuantity(bookId, newQuantity, maxInventory) {
    // Don't allow negative quantities
    if (newQuantity <= 0) {
        removeFromCart(bookId);
        return;
    }

    // Check inventory limit
    if (newQuantity > maxInventory) {
        alert(`Cannot add more than ${maxInventory} items (current stock limit)`);
        return;
    }

    // Find current cart item
    const cartItem = cart.find(item => item.bookId === bookId);
    if (!cartItem) return;

    // Update cart state
    cartItem.quantity = newQuantity;

    // Update UI
    const itemContainer = document.querySelector(`div[data-book-id="${bookId}"]`);
    if (itemContainer) {
        const quantitySpan = itemContainer.querySelector('.quantity');
        const itemTotalSpan = itemContainer.querySelector('.item-total');

        if (quantitySpan) {
            quantitySpan.textContent = newQuantity;
        }

        // Update item total price
        fetch(`${apiUrl}/books/${bookId}`)
            .then(response => response.json())
            .then(book => {
                const itemTotal = book.price * newQuantity;
                if (itemTotalSpan) {
                    itemTotalSpan.textContent = `$${itemTotal.toFixed(2)}`;
                }
                updateCartSummary();
            });
    }

    updateCartCount();
}

function updateCartSummary() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

    Promise.all(cart.map(item =>
        fetch(`${apiUrl}/books/${item.bookId}`)
            .then(response => response.json())
            .then(book => book.price * item.quantity)
    )).then(itemTotals => {
        const totalCost = itemTotals.reduce((sum, total) => sum + total, 0);

        // Update summary display
        const summaryDiv = document.querySelector('.cart-summary');
        if (summaryDiv) {
            const itemCountElem = summaryDiv.querySelector('p:first-of-type strong');
            const totalCostElem = summaryDiv.querySelector('p:last-of-type strong');

            if (itemCountElem) {
                itemCountElem.textContent = `Total Items: ${totalItems}`;
            }
            if (totalCostElem) {
                totalCostElem.textContent = `Total Cost: $${totalCost.toFixed(2)}`;
            }
        }
    });
}

/**
 * Removes an item from the cart.
 *
 * @param {string} bookId - The ID of the book to remove.
 */
function removeFromCart(bookId) {
    // Find the item in cart
    const itemIndex = cart.findIndex(item => item.bookId === bookId);
    if (itemIndex === -1) return;

    // Remove item from cart array
    cart.splice(itemIndex, 1);

    // Find and remove the DOM element
    const bookElement = document.querySelector(`div[data-book-id="${bookId}"]`);
    if (bookElement) {
        bookElement.remove();
    }

    // Update cart count
    updateCartCount();

    // If cart is empty, show empty cart message
    if (cart.length === 0) {
        const content = document.getElementById('content');
        content.innerHTML = `
            <h2>Your Shopping Cart</h2>
            <div class="empty-cart">
                <p>Your cart is empty.</p>
                <button onclick="showHome()">Continue Shopping</button>
            </div>
        `;
    } else {
        // Update the cart summary if items remain
        updateCartSummary();
    }
}

/**
 * Processes the checkout by validating inventory and submitting the order.
 */
function checkout() {
    const token = getAuthToken();
    if (!token) {
        alert('You must log in to proceed with the checkout.');
        return;
    }

    const validationPromises = cart.map(cartItem => {
        return fetch(`${apiUrl}/books/${cartItem.bookId}`)
            .then(response => response.json())
            .then(book => {
                if (cartItem.quantity > book.inventory) {
                    throw new Error(`Not enough inventory for ${book.title}. Available: ${book.inventory}, In Cart: ${cartItem.quantity}`);
                }
            });
    });

    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Processing...';
    }

    Promise.all(validationPromises)
        .then(() => {
            return fetch(`${apiUrl}/purchase/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(cart)
            });
        })
        .then(response => {
            if (response.ok) {
                showCheckoutSuccess();
                cart = [];
                updateCartCount();
            } else {
                return response.text().then(text => { throw new Error(text); });
            }
        })
        .catch(error => {
            console.error('Error during checkout:', error);
            alert(error.message);
        })
        .finally(() => {
            if (checkoutBtn) {
                checkoutBtn.disabled = false;
                checkoutBtn.textContent = 'Proceed to Checkout';
            }
        });
}

/**
 * Displays the success message after a successful checkout.
 */
function showCheckoutSuccess() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="checkout-success">
            <h2>🎉 Order Successful!</h2>
            <p>Thank you for your purchase. Your order has been successfully processed.</p>
            <div class="success-actions">
                <button onclick="viewPurchaseHistory()">View Purchase History</button>
                <button onclick="showHome()">Continue Shopping</button>
            </div>
        </div>
    `;
}

/**
 * Fetches and displays the user's purchase history.
 */
function viewPurchaseHistory() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="purchase-history-container">
            <h2>Purchase History</h2>
            <div id="purchaseRecords">
                <div class="loading">Loading purchase history...</div>
            </div>
        </div>
    `;

    const token = getAuthToken();
    if (!token) {
        content.innerHTML = `
            <div class="purchase-history-container">
                <h2>Purchase History</h2>
                <div class="empty-history">
                    <p>Please log in to view your purchase history.</p>
                    <button onclick="showHome()">Return to Home</button>
                </div>
            </div>
        `;
        return;
    }

    fetch(`${apiUrl}/purchase/history`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(response.status === 403
                    ? 'You do not have permission to view purchase history'
                    : 'Failed to fetch purchase history');
            }
            return response.json();
        })
        .then(purchases => {
            const purchaseRecords = document.getElementById('purchaseRecords');

            if (!purchases || purchases.length === 0) {
                purchaseRecords.innerHTML = `
                    <div class="empty-history">
                        <p>No purchase history found.</p>
                        <button onclick="showHome()">Start Shopping</button>
                    </div>
                `;
                return;
            }

            // Sort purchases by date (newest first)
            const sortedPurchases = purchases.sort((a, b) =>
                new Date(b.purchaseDate) - new Date(a.purchaseDate)
            );

            purchaseRecords.innerHTML = sortedPurchases.map(purchase => {
                let totalItems = 0;
                let totalCost = 0;

                const itemsList = purchase.items.map(item => {
                    const quantity = item.quantity || 0;
                    const price = item.purchasePrice || 0;
                    const itemTotal = price * quantity;
                    totalItems += quantity;
                    totalCost += itemTotal;

                    // Create a unique ID for this specific purchase item
                    const uniqueImageId = `book-img-${purchase.id}-${item.bookId}`;

                    // Get the book image URL
                    if (item.bookId) {
                        fetch(`${apiUrl}/books/${item.bookId}`)
                            .then(response => response.json())
                            .then(book => {
                                const imgElement = document.getElementById(uniqueImageId);
                                if (imgElement) {
                                    imgElement.src = book.imageName ? `/api/books/image/${book.imageName}` : '/api/placeholder/80/120';
                                }
                            })
                            .catch(() => {
                                console.log('Failed to fetch book image');
                            });
                    }

                    return `
                        <div class="purchase-item">
                            <div class="purchase-item-image">
                                <img id="${uniqueImageId}" 
                                     src="/api/placeholder/80/120" 
                                     alt="${item.title}"
                                     loading="lazy">
                            </div>
                            <div class="purchase-item-details">
                                <h3 class="purchase-item-title">${item.title}</h3>
                                <p class="purchase-item-author">by ${item.author}</p>
                                <p class="purchase-item-isbn">ISBN: ${item.isbn}</p>
                            </div>
                            <div class="purchase-item-price">
                                <div class="price-details">
                                    <p>Quantity: ${quantity}</p>
                                    <p>Price: $${price.toFixed(2)}</p>
                                </div>
                                <p class="total-price">Total: $${itemTotal.toFixed(2)}</p>
                            </div>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="purchase-record">
                        <div class="purchase-header">
                            <div class="purchase-date">
                                ${new Date(purchase.purchaseDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}
                            </div>
                            <div class="purchase-summary">
                                <p>Items: ${totalItems}</p>
                                <p>Total: $${totalCost.toFixed(2)}</p>
                            </div>
                        </div>
                        <div class="purchase-items">
                            ${itemsList}
                        </div>
                    </div>
                `;
            }).join('');
        })
        .catch(error => {
            console.error('Error fetching purchase history:', error);
            content.innerHTML = `
                <div class="purchase-history-container">
                    <h2>Purchase History</h2>
                    <div class="error-message">
                        <p>${error.message || 'An error occurred while loading purchase history.'}</p>
                        <button onclick="showHome()">Return to Home</button>
                    </div>
                </div>
            `;
        });
}