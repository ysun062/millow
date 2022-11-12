const { expect } = require('chai');
const { ethers } = require('hardhat');

const tokens = (n) => {
    return ethers.utils.parseUnits(n.toString(), 'ether')
}

describe('Escrow', () => {
    let buyer, seller, inspector, lender
    let realEstate, escrow

    beforeEach(async () => {
        // Setup accounts
        [buyer, seller, inspector, lender] = await ethers.getSigners();

        // Deploy Real Estate
        const RealEstate = await ethers.getContractFactory('RealEstate');
        realEstate = await RealEstate.deploy();

        // Mint
        let transaction = await realEstate.connect(seller).mint("https://ipfs.io/ipfs/QmTudSYeM7mz3PkYEWXWqPjomRPHogcMFSq7XAvsvsgAPS");
        await transaction.wait();

        const Escrow = await ethers.getContractFactory('Escrow');
        escrow = await Escrow.deploy(realEstate.address, seller.address, inspector.address, lender.address);

        // Approve property
        transaction = await realEstate.connect(seller).approve(escrow.address, 1);
        await transaction.wait();

        // List property
        transaction = await escrow.connect(seller).list(1, buyer.address, tokens(10), tokens(5));
        await transaction.wait();

    })

    describe('Deployment', () => {
        it('Returns NFT address', async () => {
            const result = await escrow.nftAddress();
            expect(result).to.equal(realEstate.address);
        })

        it('Returns seller address', async () => {
            const result = await escrow.seller();
            expect(result).to.equal(seller.address);
        })
        it('Returns inspector address', async () => {
            const result = await escrow.inspector();
            expect(result).to.equal(inspector.address);
        })
        it('Returns lender address', async () => {
            const result = await escrow.lender();
            expect(result).to.equal(lender.address);
        })
    })

    describe('Listing', () => {
        it('Updates as listed', async () => {
            const result = await escrow.isListed(1);
            expect(result).to.equal(true);
        })

        it('Updates ownership of NFT', async () => {
            expect(await realEstate.ownerOf(1)).to.equal(escrow.address);
        })

        it('Returns buyer address', async () => {
            const result = await escrow.buyer(1);
            expect(result).to.equal(buyer.address);
        })

        it('Returns purchase price', async () => {
            const result = await escrow.purchasedPrice(1);
            expect(result).to.equal(tokens(10));
        })

        it('Returns escrow amount', async () => {
            const result = await escrow.escrowAmount(1);
            expect(result).to.equal(tokens(5));
        })
    })

    describe('Deposits', () => {
        it('Updates contract balance', async () => {
            const transaction = await escrow.connect(buyer).depositEarnest(1, { value: tokens(5) });
            await transaction.wait();
            const result = await escrow.getBalance();
            expect(result).to.be.equal(tokens(5));
        })
    })

    describe('Inspection', () => {
        it('Updates Inspection Status', async () => {
            const transaction = await escrow.connect(inspector).updateInspectionStatus(1, true);
            await transaction.wait();
            const result = await escrow.inspectionPassed(1);
            expect(result).to.be.equal(true);
        })
    })

    describe('Approval', () => {
        it('Updates Approval Status', async () => {
            let transaction = await escrow.connect(buyer).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(lender).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(seller).approveSale(1);
            await transaction.wait();

            expect(await escrow.approval(1, buyer.address)).to.be.equal(true);
            expect(await escrow.approval(1, seller.address)).to.be.equal(true);
            expect(await escrow.approval(1, lender.address)).to.be.equal(true);
        })
    })

    describe('Sale', async () => {
        beforeEach(async () => {
            let transaction = await escrow.connect(buyer).depositEarnest(1, { value: tokens(5) });
            await transaction.wait();

            transaction = await escrow.connect(inspector).updateInspectionStatus(1, true);
            await transaction.wait();

            transaction = await escrow.connect(buyer).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(lender).approveSale(1);
            await transaction.wait();

            transaction = await escrow.connect(seller).approveSale(1);
            await transaction.wait();

            await lender.sendTransaction({ to: escrow.address, value: tokens(5) });

            transaction = await escrow.connect(seller).finalizeSale(1);
            await transaction.wait();
        })

        it('Updates Ownership', async () => {
            expect(await realEstate.ownerOf(1)).to.equal(buyer.address);
        })

        it ('updates balance' , async () => {
            expect(await escrow.getBalance()).to.be.equal(tokens(0));
        })
    })

})
